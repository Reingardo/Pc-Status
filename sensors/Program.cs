// pc-sensors: lee el hardware con LibreHardwareMonitor y escribe una línea JSON
// por segundo. La app Tauri la lee y la manda a la interfaz.
//
// Canal con la app:
// - `--pipe <nombre>`: se conecta al named pipe \\.\pipe\<nombre> que crea la app.
//   Es el modo normal: la app lanza este proceso con permisos de administrador (UAC)
//   y un proceso elevado no puede heredar su stdin/stdout.
// - sin `--pipe`: stdin/stdout (para probarlo a mano).
// Este proceso solo LEE sensores: no escribe archivos, no abre conexiones de red
// y termina en cuanto la app cierra el canal.
using System.IO.Pipes;
using System.Security.Principal;
using System.Text.Json;
using LibreHardwareMonitor.Hardware;

var pipeIdx = Array.IndexOf(args, "--pipe");
var pipeName = pipeIdx >= 0 && pipeIdx + 1 < args.Length ? args[pipeIdx + 1] : null;
var intervalMs = args.FirstOrDefault(a => int.TryParse(a, out _)) is { } msArg ? int.Parse(msArg) : 1000;
var isAdmin = new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);

TextReader input = Console.In;
TextWriter output = Console.Out;
if (pipeName is not null)
{
    var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
    pipe.Connect(10_000); // la app ya está esperando; si no aparece, salir con error
    input = new StreamReader(pipe);
    output = new StreamWriter(pipe) { AutoFlush = false };
}

var computer = new Computer
{
    IsCpuEnabled = true,
    IsGpuEnabled = true,
    IsMemoryEnabled = true,
    IsMotherboardEnabled = true,
    IsStorageEnabled = true,
    IsNetworkEnabled = true,
};
computer.Open();

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
var computerLock = new object();
var cts = new CancellationTokenSource();

void Emit(object payload)
{
    var line = JsonSerializer.Serialize(payload, json);
    try
    {
        lock (output) { output.WriteLine(line); output.Flush(); }
    }
    catch (IOException)
    {
        cts.Cancel(); // la app cerró el canal: terminar
    }
}

void EmitInventory() => Task.Run(() =>
{
    try { Emit(Inventory.Collect(computer, computerLock)); }
    catch (Exception e) { Console.Error.WriteLine("[inventory] " + e.Message); }
});

// Órdenes de la app: "inventory" = volver a detectar el hardware.
// Si la app se cierra, el canal llega a EOF y salimos.
_ = Task.Run(() =>
{
    try
    {
        string? cmd;
        while ((cmd = input.ReadLine()) != null)
        {
            if (cmd.Trim() == "quit") break;
            if (cmd.Trim() == "inventory") EmitInventory();
        }
    }
    catch { }
    cts.Cancel();
});

EmitInventory();

while (!cts.IsCancellationRequested)
{
    try
    {
        object snap;
        lock (computerLock)
        {
            foreach (var hw in computer.Hardware) Update(hw);
            snap = Snapshot();
        }
        Emit(snap);
    }
    catch (Exception e)
    {
        Console.Error.WriteLine("[pc-sensors] " + e.Message);
    }
    try { await Task.Delay(intervalMs, cts.Token); } catch (TaskCanceledException) { }
}
computer.Close();
return;

// ---------------------------------------------------------------------------

static void Update(IHardware hw)
{
    hw.Update();
    foreach (var sub in hw.SubHardware) Update(sub);
}

static IEnumerable<ISensor> AllSensors(IHardware hw) =>
    hw.Sensors.Concat(hw.SubHardware.SelectMany(AllSensors));

static float? Find(IHardware? hw, SensorType type, params string[] names)
{
    if (hw is null) return null;
    var sensors = AllSensors(hw).Where(s => s.SensorType == type && s.Value.HasValue).ToList();
    foreach (var n in names)
    {
        var s = sensors.FirstOrDefault(x => x.Name.Equals(n, StringComparison.OrdinalIgnoreCase));
        if (s is not null) return s.Value;
    }
    return null;
}

static float? FirstPositive(IHardware? hw, SensorType type) =>
    hw is null ? null : AllSensors(hw).FirstOrDefault(s => s.SensorType == type && s.Value > 0)?.Value;

static float? Round(float? v, int d = 1) => v.HasValue ? (float)Math.Round(v.Value, d) : null;

// Sin permisos de administrador algunos sensores devuelven 0: lo tratamos como "sin dato".
static float? Positive(float? v) => v > 0 ? v : null;

object Snapshot()
{
    var hw = computer.Hardware;

    // --- CPU ---
    var cpu = hw.FirstOrDefault(h => h.HardwareType == HardwareType.Cpu);
    float[] coreLoads = cpu is null ? [] : AllSensors(cpu)
        .Where(s => s.SensorType == SensorType.Load && s.Name.StartsWith("CPU Core #") && s.Value.HasValue)
        .Select(s => (float)Math.Round(s.Value!.Value, 1)).ToArray();
    float[] coreClocks = cpu is null ? [] : AllSensors(cpu)
        .Where(s => s.SensorType == SensorType.Clock && s.Name.StartsWith("Core #") && s.Value > 0)
        .Select(s => s.Value!.Value).ToArray();
    var cpuTemp = Find(cpu, SensorType.Temperature,
        "CPU Package", "Core (Tctl/Tdie)", "Core (Tdie)", "Core (Tctl)", "Core Max", "Core Average")
        ?? FirstPositive(cpu, SensorType.Temperature);

    // --- GPU (prioriza la dedicada) ---
    var gpu = hw.FirstOrDefault(h => h.HardwareType == HardwareType.GpuNvidia)
           ?? hw.FirstOrDefault(h => h.HardwareType == HardwareType.GpuAmd)
           ?? hw.FirstOrDefault(h => h.HardwareType == HardwareType.GpuIntel);

    // --- RAM ---
    var mem = hw.FirstOrDefault(h => h.HardwareType == HardwareType.Memory && h.Name.Contains("Total", StringComparison.OrdinalIgnoreCase))
           ?? hw.FirstOrDefault(h => h.HardwareType == HardwareType.Memory);
    var memUsed = Find(mem, SensorType.Data, "Memory Used");
    var memFree = Find(mem, SensorType.Data, "Memory Available");

    // --- Discos ---
    var disks = hw.Where(h => h.HardwareType == HardwareType.Storage).Select(d => new
    {
        name = d.Name,
        temp = Round(Find(d, SensorType.Temperature, "Temperature", "Composite Temperature") ?? FirstPositive(d, SensorType.Temperature)),
        used = Round(Find(d, SensorType.Load, "Used Space")),
        activity = Round(Find(d, SensorType.Load, "Total Activity")),
    }).ToArray();

    // --- Red (adaptador con más tráfico) ---
    // Windows duplica cada adaptador con capas de filtro (WFP, QoS, Npcap...): las ignoramos.
    string[] virtualTags = ["Filter", "Scheduler", "WFP", "QoS", "Npcap", "Miniport", "Loopback"];
    var adapters = hw.Where(h => h.HardwareType == HardwareType.Network).ToList();
    var physical = adapters.Where(a => !virtualTags.Any(t => a.Name.Contains(t, StringComparison.OrdinalIgnoreCase))).ToList();
    var net = (physical.Count > 0 ? physical : adapters).Select(n => new
    {
        name = n.Name,
        up = Find(n, SensorType.Throughput, "Upload Speed") ?? 0,
        down = Find(n, SensorType.Throughput, "Download Speed") ?? 0,
    }).OrderByDescending(n => n.up + n.down).FirstOrDefault();

    // --- Ventiladores de la placa base ---
    var board = hw.FirstOrDefault(h => h.HardwareType == HardwareType.Motherboard);
    var fans = board is null ? [] : AllSensors(board)
        .Where(s => s.SensorType == SensorType.Fan && s.Value > 0)
        .Select(s => new { name = s.Name, rpm = (int)Math.Round(s.Value!.Value) }).ToArray();

    return new
    {
        time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        admin = isAdmin,
        // Driver que LibreHardwareMonitor necesita para temperaturas de CPU, ventiladores y voltajes.
        pawnIo = new
        {
            installed = LibreHardwareMonitor.PawnIo.PawnIo.IsInstalled,
            version = LibreHardwareMonitor.PawnIo.PawnIo.Version?.ToString(),
        },
        cpu = cpu is null ? null : new
        {
            name = cpu.Name,
            load = Round(Find(cpu, SensorType.Load, "CPU Total")),
            temp = Round(Positive(cpuTemp)),
            clock = coreClocks.Length > 0 ? (float?)Math.Round(coreClocks.Average()) : null,
            power = Round(Positive(Find(cpu, SensorType.Power, "CPU Package", "Package"))),
            cores = coreLoads,
        },
        gpu = gpu is null ? null : new
        {
            name = gpu.Name,
            load = Round(Find(gpu, SensorType.Load, "GPU Core", "D3D 3D")),
            temp = Round(Find(gpu, SensorType.Temperature, "GPU Core", "GPU Hot Spot")),
            clock = Round(Find(gpu, SensorType.Clock, "GPU Core"), 0),
            power = Round(Find(gpu, SensorType.Power, "GPU Package", "GPU Power", "GPU Core")),
            vramUsed = Round(Find(gpu, SensorType.SmallData, "GPU Memory Used", "D3D Dedicated Memory Used"), 0),
            vramTotal = Round(Find(gpu, SensorType.SmallData, "GPU Memory Total"), 0),
            fanRpm = Round(Find(gpu, SensorType.Fan, "GPU Fan", "GPU Fan 1") ?? FirstPositive(gpu, SensorType.Fan), 0),
        },
        ram = mem is null ? null : new
        {
            load = Round(Find(mem, SensorType.Load, "Memory")),
            used = Round(memUsed, 2),
            total = memUsed.HasValue && memFree.HasValue ? Round(memUsed + memFree, 1) : null,
        },
        disks,
        net,
        fans,
    };
}

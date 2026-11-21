// Inventario de hardware: qué componentes tiene el PC (modelo, capacidad, slots...).
// Usa WMI de Windows (no necesita administrador) + la lista de LibreHardwareMonitor.
using System.Management;
using LibreHardwareMonitor.Hardware;

static class Inventory
{
    public static object Collect(Computer computer, object computerLock)
    {
        // --- Sistema ---
        var os = Query("SELECT Caption, Version, BuildNumber, OSArchitecture FROM Win32_OperatingSystem").FirstOrDefault();
        var cs = Query("SELECT Manufacturer, Model FROM Win32_ComputerSystem").FirstOrDefault();

        // --- Procesador ---
        var cpus = Query("SELECT Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, SocketDesignation, L2CacheSize, L3CacheSize FROM Win32_Processor")
            .Select(p => new
            {
                name = Str(p, "Name"),
                manufacturer = Str(p, "Manufacturer"),
                cores = Num(p, "NumberOfCores"),
                threads = Num(p, "NumberOfLogicalProcessors"),
                maxClock = Num(p, "MaxClockSpeed"), // MHz
                socket = Str(p, "SocketDesignation"),
                l2KB = Num(p, "L2CacheSize"),
                l3KB = Num(p, "L3CacheSize"),
            }).ToList();

        // --- Sensores de LibreHardwareMonitor (también da la VRAM real) ---
        List<(string type, string name)> lhm;
        Dictionary<string, float> vramByName = new(StringComparer.OrdinalIgnoreCase);
        lock (computerLock)
        {
            lhm = computer.Hardware
                .SelectMany(h => new[] { h }.Concat(h.SubHardware))
                .Select(h => (h.HardwareType.ToString(), h.Name)).ToList();
            foreach (var g in computer.Hardware.Where(h => h.HardwareType is HardwareType.GpuNvidia or HardwareType.GpuAmd or HardwareType.GpuIntel))
            {
                var total = g.Sensors.FirstOrDefault(s => s.SensorType == SensorType.SmallData && s.Name == "GPU Memory Total")?.Value;
                if (total > 0) vramByName[g.Name] = total.Value;
            }
        }

        // --- Gráficas ---
        var gpus = Query("SELECT Name, AdapterCompatibility, DriverVersion, DriverDate, AdapterRAM, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate FROM Win32_VideoController")
            .Select(v =>
            {
                var name = Str(v, "Name") ?? "GPU";
                var vram = vramByName.FirstOrDefault(kv => name.Contains(kv.Key, StringComparison.OrdinalIgnoreCase) || kv.Key.Contains(name, StringComparison.OrdinalIgnoreCase)).Value;
                var w = Num(v, "CurrentHorizontalResolution");
                var h = Num(v, "CurrentVerticalResolution");
                return new
                {
                    name,
                    vendor = Str(v, "AdapterCompatibility"),
                    driver = Str(v, "DriverVersion"),
                    driverDate = Date(v, "DriverDate"),
                    // AdapterRAM de WMI se queda en 4 GB como máximo: preferimos el dato de LHM.
                    vramGB = vram > 0 ? Math.Round(vram / 1024d, 1) : Gb(Num(v, "AdapterRAM")),
                    resolution = w > 0 && h > 0 ? $"{w} × {h}" : null,
                    refreshHz = Num(v, "CurrentRefreshRate"),
                };
            }).ToList();

        // --- Placa base y BIOS ---
        var bb = Query("SELECT Manufacturer, Product, Version FROM Win32_BaseBoard").FirstOrDefault();
        var bios = Query("SELECT Manufacturer, SMBIOSBIOSVersion, ReleaseDate FROM Win32_BIOS").FirstOrDefault();
        var superIo = lhm.FirstOrDefault(x => x.type == "SuperIO").name;

        // --- Memoria RAM ---
        var modules = Query("SELECT DeviceLocator, BankLabel, Capacity, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, SMBIOSMemoryType FROM Win32_PhysicalMemory")
            .Select(m => new
            {
                slot = Str(m, "DeviceLocator") ?? Str(m, "BankLabel"),
                capacityGB = Gb(Num(m, "Capacity"), 0),
                speed = Num(m, "ConfiguredClockSpeed") is > 0 and var cfg ? cfg : Num(m, "Speed"),
                maxSpeed = Num(m, "Speed"),
                manufacturer = Str(m, "Manufacturer"),
                partNumber = Str(m, "PartNumber"),
                type = MemoryType(Num(m, "SMBIOSMemoryType")),
            }).ToList();
        var slots = Query("SELECT MemoryDevices FROM Win32_PhysicalMemoryArray").Sum(a => Num(a, "MemoryDevices") ?? 0);

        // --- Almacenamiento ---
        var disks = Query("SELECT FriendlyName, Size, MediaType, BusType FROM MSFT_PhysicalDisk", @"root\Microsoft\Windows\Storage")
            .Select(d => new
            {
                model = Str(d, "FriendlyName"),
                sizeGB = Gb(Num(d, "Size"), 0),
                media = Num(d, "MediaType") switch { 3 => "HDD", 4 => "SSD", 5 => "SCM", _ => null },
                bus = Num(d, "BusType") switch { 17 => "NVMe", 11 => "SATA", 7 => "USB", 8 => "RAID", 10 => "SAS", 12 => "SD", _ => null },
            }).OrderBy(d => d.model).ToList();
        if (disks.Count == 0)
        {
            disks = Query("SELECT Model, Size, InterfaceType FROM Win32_DiskDrive")
                .Select(d => new { model = Str(d, "Model"), sizeGB = Gb(Num(d, "Size"), 0), media = (string?)null, bus = Str(d, "InterfaceType") })
                .ToList();
        }

        // --- Red ---
        var network = Query("SELECT Name, NetConnectionID, Speed, NetEnabled FROM Win32_NetworkAdapter WHERE PhysicalAdapter = TRUE")
            .Select(n => new
            {
                name = Str(n, "Name"),
                connection = Str(n, "NetConnectionID"),
                speedMbps = Num(n, "Speed") is > 0 and < 1_000_000_000_000 and var s ? s / 1_000_000 : (long?)null,
                connected = n["NetEnabled"] as bool? ?? false,
            })
            .Where(n => n.connection is not null)
            .OrderByDescending(n => n.connected).ToList();

        // --- Monitores ---
        var monitors = Query("SELECT UserFriendlyName, ManufacturerName FROM WmiMonitorID", @"root\wmi")
            .Select(m => new { name = Chars(m, "UserFriendlyName"), manufacturer = Chars(m, "ManufacturerName") })
            .Where(m => m.name is not null).ToList();

        // --- Audio ---
        var audio = Query("SELECT Name, Manufacturer FROM Win32_SoundDevice WHERE Status = 'OK'")
            .Select(a => new { name = Str(a, "Name"), manufacturer = Str(a, "Manufacturer") })
            .DistinctBy(a => a.name).ToList();

        return new
        {
            kind = "inventory",
            collectedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            system = new
            {
                computerName = Environment.MachineName,
                os = os is null ? null : Str(os, "Caption")?.Replace("Microsoft ", ""),
                version = os is null ? null : Str(os, "Version"),
                build = os is null ? null : Str(os, "BuildNumber"),
                arch = os is null ? null : Str(os, "OSArchitecture"),
                manufacturer = cs is null ? null : Str(cs, "Manufacturer"),
                model = cs is null ? null : Str(cs, "Model"),
                uptimeSec = Environment.TickCount64 / 1000,
            },
            cpus,
            gpus,
            board = new
            {
                manufacturer = bb is null ? null : Str(bb, "Manufacturer"),
                product = bb is null ? null : Str(bb, "Product"),
                version = bb is null ? null : Str(bb, "Version"),
                biosVendor = bios is null ? null : Str(bios, "Manufacturer"),
                biosVersion = bios is null ? null : Str(bios, "SMBIOSBIOSVersion"),
                biosDate = bios is null ? null : Date(bios, "ReleaseDate"),
                sensorChip = superIo,
            },
            memory = new
            {
                totalGB = modules.Sum(m => m.capacityGB),
                slots = slots > 0 ? slots : modules.Count,
                modules,
            },
            disks,
            network,
            monitors,
            audio,
            // Los adaptadores de red ya salen arriba (y LHM lista decenas de capas virtuales).
            sensorHardware = lhm.Where(x => x.type != "Network").Select(x => new { x.type, x.name }),
        };
    }

    // ---------------------------------------------------------------- helpers

    static List<ManagementBaseObject> Query(string query, string scope = @"root\cimv2")
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(scope, query);
            return searcher.Get().Cast<ManagementBaseObject>().ToList();
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"[inventory] {query}: {e.Message}");
            return [];
        }
    }

    static string? Str(ManagementBaseObject o, string prop)
    {
        try
        {
            var v = o[prop]?.ToString()?.Trim();
            return string.IsNullOrEmpty(v) ? null : v;
        }
        catch { return null; }
    }

    static long? Num(ManagementBaseObject o, string prop)
    {
        try { return o[prop] is { } v ? Convert.ToInt64(v) : null; }
        catch { return null; }
    }

    static string? Date(ManagementBaseObject o, string prop)
    {
        try { return Str(o, prop) is { } s ? ManagementDateTimeConverter.ToDateTime(s).ToString("yyyy-MM-dd") : null; }
        catch { return null; }
    }

    /// WmiMonitorID guarda los textos como arrays de códigos de carácter.
    static string? Chars(ManagementBaseObject o, string prop)
    {
        try
        {
            if (o[prop] is not ushort[] arr) return null;
            var s = new string(arr.TakeWhile(c => c != 0).Select(c => (char)c).ToArray()).Trim();
            return s.Length > 0 ? s : null;
        }
        catch { return null; }
    }

    static double Gb(long? bytes, int digits = 1) =>
        bytes is > 0 ? Math.Round(bytes.Value / 1024d / 1024 / 1024, digits) : 0;

    static string? MemoryType(long? smbios) => smbios switch
    {
        20 => "DDR", 21 => "DDR2", 24 => "DDR3", 26 => "DDR4", 30 => "LPDDR4", 34 => "DDR5", 35 => "LPDDR5",
        _ => null,
    };
}

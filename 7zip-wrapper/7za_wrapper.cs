using System;
using System.Diagnostics;
using System.IO;

class Program
{
    static int Main(string[] args)
    {
        string currentDir = AppDomain.CurrentDomain.BaseDirectory;
        string real7z = Path.Combine(currentDir, "7za_real.exe");
        
        if (!File.Exists(real7z))
        {
            Console.WriteLine("[7za-wrapper] Error: 7za_real.exe not found at " + real7z);
            return 1;
        }

        // Reconstruct arguments escaping properly
        string arguments = "";
        for (int i = 0; i < args.Length; i++)
        {
            string arg = args[i];
            if (arg.Contains(" ") || arg.Contains("\""))
            {
                arg = "\"" + arg.Replace("\"", "\\\"") + "\"";
            }
            arguments += arg + " ";
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = real7z;
        psi.Arguments = arguments.Trim();
        psi.UseShellExecute = false;
        psi.RedirectStandardOutput = false;
        psi.RedirectStandardError = false;
        psi.CreateNoWindow = false;

        try
        {
            using (Process p = Process.Start(psi))
            {
                p.WaitForExit();
                int exitCode = p.ExitCode;
                Console.WriteLine("[7za-wrapper] Real 7za exited with: " + exitCode);
                if (exitCode == 0 || exitCode == 2)
                {
                    Console.WriteLine("[7za-wrapper] Forcing exit code to 0.");
                    return 0;
                }
                return exitCode;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[7za-wrapper] Exception: " + ex.Message);
            return 1;
        }
    }
}

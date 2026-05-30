use std::fs::{File, OpenOptions};
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::path::BaseDirectory;
use tauri::{Manager, RunEvent};

const PORT: u16 = 2208;

fn debug_log_dir() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    let mut p = PathBuf::from(home);
    p.push(".m-termius");
    let _ = std::fs::create_dir_all(&p);
    Some(p)
}

fn debug_log(msg: &str) {
    if let Some(mut p) = debug_log_dir() {
        p.push("tauri-debug.log");
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&p) {
            let _ = writeln!(f, "[{:?}] {}", std::time::SystemTime::now(), msg);
        }
    }
}

/// Strip the `\\?\` extended-length prefix that Tauri's path resolver adds.
/// Node.js on Windows handles these inconsistently for argv[0] / cwd.
fn strip_unc(p: PathBuf) -> PathBuf {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest.to_string())
    } else {
        p
    }
}

struct ServerHandle(Mutex<Option<Child>>);

#[tauri::command]
fn server_status(state: tauri::State<ServerHandle>) -> bool {
    let mut guard = state.0.lock().unwrap();
    match guard.as_mut() {
        Some(child) => match child.try_wait() {
            Ok(None) => true,
            _ => false,
        },
        None => false,
    }
}

fn locate_node() -> Option<String> {
    let candidates = [
        "node.exe",
        "node",
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ];
    for c in candidates.iter() {
        if Command::new(c)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
        {
            debug_log(&format!("located node: {}", c));
            return Some(c.to_string());
        }
    }
    debug_log("node.exe NOT FOUND");
    None
}

fn spawn_sidecar(app: &tauri::AppHandle) -> Option<Child> {
    let resolver = app.path();
    let raw = resolver
        .resolve("sidecar/m-termius-sidecar.cjs", BaseDirectory::Resource)
        .ok()?;
    let sidecar = strip_unc(raw);
    debug_log(&format!("sidecar path: {:?}, exists: {}", sidecar, sidecar.exists()));
    if !sidecar.exists() {
        return None;
    }
    let node = locate_node()?;
    let resource_root = strip_unc(sidecar.parent()?.to_path_buf());
    debug_log(&format!("cwd: {:?}", resource_root));

    // Pipe sidecar stdout/stderr to log files so failures are visible.
    let log_dir = debug_log_dir()?;
    let stdout_path = log_dir.join("sidecar-stdout.log");
    let stderr_path = log_dir.join("sidecar-stderr.log");
    let stdout_file = File::create(&stdout_path).ok()?;
    let stderr_file = File::create(&stderr_path).ok()?;

    let mut cmd = Command::new(&node);
    cmd.arg(&sidecar)
        .arg("ui")
        .arg("--no-tunnel")
        .arg("--no-auth")
        .env("PORT", PORT.to_string())
        .env("MTERMIUS_RESOURCE_ROOT", resource_root.as_os_str())
        .current_dir(&resource_root);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file));
    match cmd.spawn() {
        Ok(child) => {
            debug_log(&format!(
                "sidecar spawned, pid={}, stdout={:?}, stderr={:?}",
                child.id(),
                stdout_path,
                stderr_path
            ));
            Some(child)
        }
        Err(e) => {
            debug_log(&format!("spawn failed: {}", e));
            None
        }
    }
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let started = Instant::now();
    let addr: std::net::SocketAddr = format!("127.0.0.1:{}", port).parse().unwrap();
    while started.elapsed() < timeout {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
            debug_log(&format!("port {} ready after {:?}", port, started.elapsed()));
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    debug_log(&format!("port {} NOT ready after {:?}", port, timeout));
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    debug_log("=== M-Termius starting ===");
    let context = tauri::generate_context!();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ServerHandle(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![server_status])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(c) = spawn_sidecar(&handle) {
                let state: tauri::State<ServerHandle> = handle.state();
                *state.0.lock().unwrap() = Some(c);
            }
            if !wait_for_port(PORT, Duration::from_secs(15)) {
                debug_log("WARN: opening WebView before server is ready");
            }
            Ok(())
        })
        .build(context)
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            if let Some(state) = app.try_state::<ServerHandle>() {
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
    });
}

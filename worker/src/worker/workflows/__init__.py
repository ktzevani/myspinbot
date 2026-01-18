_COMFY_ROOT_PATH = None


def load_comfy_module(file_path):
    import importlib.util
    import os

    spec = importlib.util.spec_from_file_location(
        os.path.basename(file_path).replace(".py", ""), file_path
    )
    if spec is not None and spec.loader is not None:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    raise RuntimeError("Unknown module.")


def initialize_comfy_environment():
    global _COMFY_ROOT_PATH
    if not _COMFY_ROOT_PATH:
        import os
        from ..config import get_config
        import sys

        worker_config = get_config()

        norm_sys_paths = [os.path.normpath(p) for p in sys.path]
        norm_root_path = os.path.normpath(worker_config.comfy.root_dir)

        if norm_root_path not in norm_sys_paths:
            sys.path.insert(0, norm_root_path)

        norm_custom_nodes_path = os.path.normpath(
            os.path.join(norm_root_path, "custom_nodes")
        )

        if norm_custom_nodes_path not in norm_sys_paths:
            sys.path.append(norm_custom_nodes_path)

        import utils
        import folder_paths

        folder_paths.output_directory = "/tmp/output"
        folder_paths.input_directory = "/tmp/input"
        folder_paths.temp_directory = "/tmp"

        import server

        if not hasattr(server.PromptServer, "instance"):
            server.PromptServer.instance = type(
                "MockInstance",
                (),
                {
                    "routes": type(
                        "MockRoutes",
                        (),
                        {
                            "get": lambda *a, **k: lambda f: f,
                            "post": lambda *a, **k: lambda f: f,
                        },
                    )(),
                    "prompt_queue": None,
                    "send_sync": lambda *a, **k: None,
                    "app": type(
                        "MockApp",
                        (),
                        {
                            "router": type(
                                "MockRouter",
                                (),
                                {"add_static": lambda *a, **k: lambda f: f},
                            )(),
                            "add_routes": lambda *a, **k: lambda f: f,
                            "frozen": None,
                        },
                    )(),
                },
            )()

        _COMFY_ROOT_PATH = norm_root_path

    return _COMFY_ROOT_PATH


__all__ = ["initialize_comfy_environment", "load_comfy_module"]

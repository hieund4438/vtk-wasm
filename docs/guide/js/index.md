# VTK.wasm from JavaScript

This guide focuses on using the VTK WASM bundle from plain JavaScript, requiring no prior C++ knowledge. VTK.wasm allows you to use [VTK](https://www.vtk.org) without needing to learn C++. This can be particularly beneficial for web developers who are already familiar with JavaScript and want to integrate advanced visualization capabilities into their web applications.

## Overview
Most C++ classes from the [VTK C++ Documentation](https://vtk.org/doc/nightly/html/) are available through a single JavaScript object, which we refer to as the **vtk** namespace.

Once you have access to the **vtk** namespace (see [Bundler Integration](./bundler.md)), you can interact with VTK classes using standard JavaScript.

<Playground console-min-height=10px>
    <textarea data-lang="html" style="display:none"><!doctype html>
<html lang="en">
    <head>
        <script
            src="https://unpkg.com/@kitware/vtk-wasm/vtk-umd.js"
            id="vtk-wasm"
            data-url="https://gitlab.kitware.com/api/v4/projects/13/packages/generic/vtk-wasm32-emscripten/9.6.20260228/vtk-9.6.20260228-wasm32-emscripten.tar.gz">
        </script>
    </head>
    <body>
    </body>
</html></textarea>
<pre data-lang="js" style="display:none">const vtk = await window.vtkReady;
</pre>
</Playground>

The following sections will guide you through the essential aspects of using VTK.wasm with JavaScript:

- [Primer on VTK.wasm](./primer.md)
- [HTML Script Tag](./plain.md)
- [Bundler Integration](./bundler.md)


/// the other way to setup gl context is to use javascipt instead of C++ Emscripten functions, then invoke it in blazor

//setupContext = (id) => {
//    var canvas = document.getElementById(id);
//    var handle = GL.createContext(canvas, {
//        antialias: false,
//        depth: false
//    });
//    GL.makeContextCurrent(handle);
//};

//By default, 
//the canvas will update only when user provides input.
//As a result
//The scene will only draw new frames 
renderLoop = () => {
    window.csharpInstance.invokeMethodAsync('RenderInBlazor');
    window.requestAnimationFrame(renderLoop);
}

//a function called from blazor after Renderer object was created
initRenderLoop = (csInstance) => {
    window.csharpInstance = csInstance;
    window.requestAnimationFrame(renderLoop);

}
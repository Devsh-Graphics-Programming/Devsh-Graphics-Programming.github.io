//By default,
//the canvas will update only when user provides input. (i.e. when clicking a mouse button or moving the mouse)
//As a result
//The scene will not draw new frames when user is idle

//to prevent this, JS will periodically invoke C# function to keep rendering
renderLoop = () => {
    window.csharpInstance.invokeMethod('RenderInBlazor');
    window.requestAnimationFrame(renderLoop);

}

//initRenderLoop - function called from Pathtracing.razor after Renderer object was created
initRenderLoop = (csInstance) => {
    window.csharpInstance = csInstance;
    window.requestAnimationFrame(renderLoop);
}

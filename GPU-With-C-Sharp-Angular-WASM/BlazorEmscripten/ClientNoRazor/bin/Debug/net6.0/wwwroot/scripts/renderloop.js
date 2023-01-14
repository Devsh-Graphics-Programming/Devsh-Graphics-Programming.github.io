//By default,
//the canvas will update only when user provides input. (i.e. when clicking a mouse button or moving the mouse)
//As a result
//The scene will not draw new frames when user is idle

//to prevent this, JS will periodically invoke C# function to keep rendering
//renderLoop = () => {
    
//    DotNet.invokeMethodAsync('BlazorEmscripten', 'RenderInBlazor'); //ClientNoRazor is the C# assembly name
//    window.requestAnimationFrame(renderLoop);

//}


//function startRenderLoop() {
//    Blazor.start().then(function () {
//        window.requestAnimationFrame(renderLoop);
//    }
//}
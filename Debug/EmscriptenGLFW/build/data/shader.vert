#version 300 es

/*
A simple vertex shader used for full screen triangle

Copyright (c) RELEX Oy

All rights reserved.

Source made public only to facilitate research and bug reproduction in WASM, Esmcripten, C# Runtimes such as Blazor, Angular and WebGL.

*/


precision highp float;
precision highp int;

in vec2 fragCoord;
void main()
{
    gl_Position = vec4( fragCoord, 0.5, 1.0 );

}
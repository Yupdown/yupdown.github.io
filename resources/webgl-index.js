"use strict";

function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl");
    if (!gl) {
        return;
    }

    // Initialize quaternion data for each cube
    var quaternions = new Array(100);  // 100 cubes, each with a quaternion [x,y,z,w]
    var rotationAxes = new Array(100);  // rotation axis for each cube (normalized vector)
    var angularVelocities = new Array(100);  // rotation speed for each cube (rad/s)
    
    for (var i = 0; i < 100; i++) {
        // Random rotation axis (normalized)
        var ax = Math.random() * 2 - 1;
        var ay = Math.random() * 2 - 1;
        var az = Math.random() * 2 - 1;
        var len = Math.sqrt(ax*ax + ay*ay + az*az);
        rotationAxes[i] = [ax/len, ay/len, az/len];
        
        // Random angular velocity (2-4 rad/s)
        angularVelocities[i] = Math.random() * 9 + 1;
        
        // Initialize identity quaternion [0, 0, 0, 1]
        quaternions[i] = [0, 0, 0, 1];
    }
    
    // Quaternion helper functions
    function quatMultiply(q1, q2) {
        return [
            q1[3]*q2[0] + q1[0]*q2[3] + q1[1]*q2[2] - q1[2]*q2[1],
            q1[3]*q2[1] - q1[0]*q2[2] + q1[1]*q2[3] + q1[2]*q2[0],
            q1[3]*q2[2] + q1[0]*q2[1] - q1[1]*q2[0] + q1[2]*q2[3],
            q1[3]*q2[3] - q1[0]*q2[0] - q1[1]*q2[1] - q1[2]*q2[2]
        ];
    }
    
    function quatFromAxisAngle(axis, angle) {
        var half = angle / 2;
        var s = Math.sin(half);
        return [axis[0]*s, axis[1]*s, axis[2]*s, Math.cos(half)];
    }

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // setup GLSL program
    var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");
    var texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
    var normalLocation = gl.getAttribLocation(program, "a_normal");

    // lookup uniforms
    var matrixLocation = gl.getUniformLocation(program, "u_mWorld");
    var viewLocation = gl.getUniformLocation(program, "u_mView");
    var projLocation = gl.getUniformLocation(program, "u_mProj");

    var textureLocation = gl.getUniformLocation(program, "u_texture");

    // Create a buffer.
    var positionBuffer = gl.createBuffer();
    var texcoordBuffer = gl.createBuffer();
    var normalBuffer = gl.createBuffer();
    var indexBuffer = gl.createBuffer();

    function buildCubeGeometry() {

        // positions (separated by face so each face can have a different color, range = -0.5 ~ 0.5)
        var positions = [
            // front
            -0.5, -0.5, 0.5,
            0.5, -0.5, 0.5,
            -0.5, 0.5, 0.5,
            0.5, 0.5, 0.5,
            // back
            0.5, -0.5, -0.5,
            -0.5, -0.5, -0.5,
            0.5, 0.5, -0.5,
            -0.5, 0.5, -0.5,
            // top
            -0.5, 0.5, 0.5,
            0.5, 0.5, 0.5,
            -0.5, 0.5, -0.5,
            0.5, 0.5, -0.5,
            // bottom
            -0.5, -0.5, -0.5,
            0.5, -0.5, -0.5,
            -0.5, -0.5, 0.5,
            0.5, -0.5, 0.5,
            // right
            0.5, -0.5, 0.5,
            0.5, -0.5, -0.5,
            0.5, 0.5, 0.5,
            0.5, 0.5, -0.5,
            // left
            -0.5, -0.5, -0.5,
            -0.5, -0.5, 0.5,
            -0.5, 0.5, -0.5,
            -0.5, 0.5, 0.5,
        ];

        // texture coordinates
        var texcoords = [
            // front
            0, 0,
            1, 0,
            0, 1,
            1, 1,
            // back
            1, 1,
            0, 1,
            1, 0,
            0, 0,
            // top
            0, 0,
            1, 0,
            0, 1,
            1, 1,
            // bottom
            0, 0,
            1, 0,
            0, 1,
            1, 1,
            // right
            0, 0,
            1, 0,
            0, 1,
            1, 1,
            // left
            0, 0,
            1, 0,
            0, 1,
            1, 1,
        ];

        var normals = [
            // front
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            // back
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            0, 0, -1,
            // top
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            0, 1, 0,
            // bottom
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            0, -1, 0,
            // right
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            // left
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
            -1, 0, 0,
        ]

        // indices
        var indices = [
            0, 1, 2, 2, 1, 3, // front
            4, 5, 6, 6, 5, 7, // back
            8, 9, 10, 10, 9, 11, // top
            12, 13, 14, 14, 13, 15, // bottom
            16, 17, 18, 18, 17, 19, // right
            20, 21, 22, 22, 21, 23, // left
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }

    buildCubeGeometry();

    function requestCORSIfNotSameOrigin(img, url) {
        if ((new URL(url, window.location.href)).origin !== window.location.origin) {
            img.crossOrigin = "";
        }
    }

    // Get anisotropic filtering extension
    var ext = gl.getExtension("EXT_texture_filter_anisotropic") ||
              gl.getExtension("MOZ_EXT_texture_filter_anisotropic") ||
              gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");

    // creates a texture info { width: w, height: h, texture: tex }
    // The texture will start with 1x1 pixels and be updated
    // when the image has loaded
    function loadImageAndCreateTextureInfo(url) {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Fill the texture with a 1x1 blue pixel.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([0, 0, 255, 255]));

        // let's assume all images are not a power of 2
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Enable anisotropic filtering if available
        if (ext) {
            var maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
        }

        var textureInfo = {
            width: 1,   // we don't know the size until it loads
            height: 1,
            texture: tex,
        };
        var img = new Image();
        img.addEventListener('load', function () {
            textureInfo.width = img.width;
            textureInfo.height = img.height;

            gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            
            // Generate mipmap for anisotropic filtering to work effectively
            gl.generateMipmap(gl.TEXTURE_2D);
            
            // Reapply anisotropic filtering after image load
            if (ext) {
                var maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
            }
        });
        requestCORSIfNotSameOrigin(img, url);
        img.src = url;

        return textureInfo;
    }

    var texInfo = loadImageAndCreateTextureInfo("./resources/icon.png");

    function render(time) {
        time *= 0.001; // convert to seconds

        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, texInfo.texture);

        // Tell WebGL to use our shader program pair
        gl.useProgram(program);

        // Setup the attributes to pull data from our buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        gl.enableVertexAttribArray(texcoordLocation);
        gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.enableVertexAttribArray(normalLocation);
        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

        // Compute the projection matrix (orthographic projection)
        // if the canvas is wider than it is tall use the height as the width
        if (aspect > 1) {
            var matrixProj = m4.orthographic(-aspect, aspect, -1, 1, -1, 1);
        }
        else {
            var matrixProj = m4.orthographic(-1, 1, -1 / aspect, 1 / aspect, -1, 1);
        }

        // Set the matrix.
        gl.uniformMatrix4fv(viewLocation, false, m4.identity());
        gl.uniformMatrix4fv(projLocation, false, matrixProj);

        // Tell the shader to get the texture from texture unit 0
        gl.uniform1i(textureLocation, 0);

        // Draw the geometry.

        for (var id = 0; id < 100; id++) {
            var c = Math.floor(id / 10) - 4.5;
            var x = (id % 10 - 4.5) * 0.7;
            var y = (c + Math.sign(c) * 0.15) * 0.7;

            // Update quaternion based on elapsed time
            var deltaAngle = angularVelocities[id] * time;
            var rotationQuat = quatFromAxisAngle(rotationAxes[id], deltaAngle);
            quaternions[id] = rotationQuat;

            // Create transformation matrix using quaternion
            var translation = [x, y, 0];
            var scale = [0.4, 0.4, 0.4];
            var matrixWorld = m4.compose(translation, quaternions[id], scale);

            gl.uniformMatrix4fv(matrixLocation, false, matrixWorld);
            gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
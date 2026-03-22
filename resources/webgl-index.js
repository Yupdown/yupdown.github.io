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
    var quaternions = new Array(100);  // 100 cubes, current quaternion state
    var targetQuaternions = new Array(100);  // target quaternion for lerp
    var rotationAxes = new Array(100);  // rotation axis for each cube (normalized vector)
    var angularVelocities = new Array(100);  // rotation speed for each cube (rad/s)
    var isMouseDown = false;
    var targetPos = null;
    var lastFrameTime = Date.now();
    
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
        targetQuaternions[i] = null;
    }
    
    // Quaternion helper functions - not currently used but kept for reference
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
    
    function normalize(v) {
        var len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if (len < 0.00001) return [0, 0, 1];  // Default look direction
        return [v[0]/len, v[1]/len, v[2]/len];
    }
    
    function cross(a, b) {
        return [
            a[1]*b[2] - a[2]*b[1],
            a[2]*b[0] - a[0]*b[2],
            a[0]*b[1] - a[1]*b[0]
        ];
    }
    
    function dot(a, b) {
        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    }
    
    // Spherical linear interpolation between two quaternions
    function quatSlerp(q1, q2, t) {
        var q2_copy = [q2[0], q2[1], q2[2], q2[3]];
        var dotProduct = q1[0]*q2[0] + q1[1]*q2[1] + q1[2]*q2[2] + q1[3]*q2[3];
        
        // If dot product is negative, negate one quaternion to take shorter path
        if (dotProduct < 0) {
            q2_copy[0] = -q2_copy[0];
            q2_copy[1] = -q2_copy[1];
            q2_copy[2] = -q2_copy[2];
            q2_copy[3] = -q2_copy[3];
            dotProduct = -dotProduct;
        }
        
        // Clamp dot product
        if (dotProduct > 0.9995) {
            // Quaternions are very close, use linear interpolation
            var result = [
                q1[0] + t * (q2_copy[0] - q1[0]),
                q1[1] + t * (q2_copy[1] - q1[1]),
                q1[2] + t * (q2_copy[2] - q1[2]),
                q1[3] + t * (q2_copy[3] - q1[3])
            ];
            var len = Math.sqrt(result[0]*result[0] + result[1]*result[1] + result[2]*result[2] + result[3]*result[3]);
            return [result[0]/len, result[1]/len, result[2]/len, result[3]/len];
        }
        
        dotProduct = Math.max(-1, Math.min(1, dotProduct));
        var theta = Math.acos(dotProduct);
        var sinTheta = Math.sin(theta);
        var w1 = Math.sin((1 - t) * theta) / sinTheta;
        var w2 = Math.sin(t * theta) / sinTheta;
        
        return [
            w1*q1[0] + w2*q2_copy[0],
            w1*q1[1] + w2*q2_copy[1],
            w1*q1[2] + w2*q2_copy[2],
            w1*q1[3] + w2*q2_copy[3]
        ];
    }
    
    // Create quaternion from look direction (from -> to)
    function quatLookAt(from, to) {
        var forward = normalize([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
        var up = [0, 1, 0];
        var right = cross(forward, up);
        right = normalize(right);
        var newUp = cross(right, forward);
        
        // Convert rotation matrix to quaternion
        var m00 = right[0], m01 = newUp[0], m02 = -forward[0];
        var m10 = right[1], m11 = newUp[1], m12 = -forward[1];
        var m20 = right[2], m21 = newUp[2], m22 = -forward[2];
        
        var trace = m00 + m11 + m22;
        var quat;
        
        if (trace > 0) {
            var s = 0.5 / Math.sqrt(trace + 1.0);
            quat = [
                (m21 - m12) * s,
                (m02 - m20) * s,
                (m10 - m01) * s,
                0.25 / s
            ];
        } else if (m00 > m11 && m00 > m22) {
            var s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            quat = [
                0.25 * s,
                (m01 + m10) / s,
                (m02 + m20) / s,
                (m21 - m12) / s
            ];
        } else if (m11 > m22) {
            var s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            quat = [
                (m01 + m10) / s,
                0.25 * s,
                (m12 + m21) / s,
                (m02 - m20) / s
            ];
        } else {
            var s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            quat = [
                (m02 + m20) / s,
                (m12 + m21) / s,
                0.25 * s,
                (m10 - m01) / s
            ];
        }
        return quat;
    }
    
    // Helper function to update target position from mouse event
    function updateTargetPosition(event) {
        // Get canvas position and mouse coordinates
        var rect = canvas.getBoundingClientRect();
        var mouseX = event.clientX - rect.left;
        var mouseY = event.clientY - rect.top;
        
        // Convert to normalized device coordinates (-1 to 1)
        var ndcX = (mouseX / rect.width) * 2 - 1;
        var ndcY = -(mouseY / rect.height) * 2 + 1;
        
        // Get aspect ratio and camera parameters
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var viewSize = 1;
        
        // Convert to world coordinates
        if (aspect > 1) {
            targetPos = [ndcX * aspect * viewSize, ndcY * viewSize, 2];
        } else {
            targetPos = [ndcX * viewSize, ndcY * viewSize / aspect, 2];
        }
        
        // Calculate look-at quaternions for all cubes
        for (var id = 0; id < 100; id++) {
            var c = Math.floor(id / 10) - 4.5;
            var x = (id % 10 - 4.5) * 0.7;
            var y = (c + Math.sign(c) * 0.15) * 0.7;
            targetQuaternions[id] = quatLookAt([x, y, 0], targetPos);
        }
    }
    
    // Add mouse down event listener
    canvas.addEventListener('mousedown', function(event) {
        isMouseDown = true;
        updateTargetPosition(event);
    });
    
    // Add mouse up event listener
    canvas.addEventListener('mouseup', function(event) {
        isMouseDown = false;
        // Reset target quaternions to auto-rotation
        for (var id = 0; id < 100; id++) {
            targetQuaternions[id] = null;
        }
    });
    
    // Add mouse move listener to update target while dragging
    canvas.addEventListener('mousemove', function(event) {
        if (!isMouseDown) return;
        updateTargetPosition(event);
    });

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
            0, 0,
            1, 0,
            0, 1,
            1, 1,
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
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
        
        // Calculate delta time for smooth lerp
        var currentTime = Date.now();
        var deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;
        var lerpFactor = Math.min(deltaTime * 8, 1);  // Smooth transition speed

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

            var finalQuat;
            
            if (targetQuaternions[id] !== null) {
                // Smoothly interpolate towards target quaternion
                finalQuat = quatSlerp(quaternions[id], targetQuaternions[id], lerpFactor);
                quaternions[id] = finalQuat;
            } else {
                // Auto-rotation when not looking at target
                var deltaAngle = angularVelocities[id] * time;
                var rotationQuat = quatFromAxisAngle(rotationAxes[id], deltaAngle);
                
                // Smoothly interpolate back to auto rotation
                finalQuat = quatSlerp(quaternions[id], rotationQuat, lerpFactor);
                quaternions[id] = finalQuat;
            }

            // Create transformation matrix using quaternion
            var translation = [x, y, 0];
            var scale = [0.4, 0.4, 0.4];
            var matrixWorld = m4.compose(translation, finalQuat, scale);

            gl.uniformMatrix4fv(matrixLocation, false, matrixWorld);
            gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
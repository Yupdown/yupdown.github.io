import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

async function main() {
    // Scene setup
    const canvas = document.querySelector("#canvas");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1492ad);
    const camera = new THREE.OrthographicCamera(-1, 1, -1, 1, -1, 1);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

    const cubeCount = 100;

    // Initialize quaternion data for each cube
    const quaternions = new Array(cubeCount);
    const targetQuaternions = new Array(cubeCount);
    const rotationAxes = new Array(cubeCount);
    const angularVelocities = new Array(cubeCount);
    /**
     * When true, cubes lerp toward look-at quaternions.
     * Touch: fixed at the tap point. Mouse/pen: updated on pointer move while on.
     */
    let lookAtMode = false;
    let targetPos = null;
    let lastFrameTime = Date.now();
    const startTime = Date.now();
    
    for (let i = 0; i < cubeCount; i++) {
        // Random rotation axis (normalized)
        let ax = Math.random() * 2 - 1;
        let ay = Math.random() * 2 - 1;
        let az = Math.random() * 2 - 1;
        let len = Math.sqrt(ax*ax + ay*ay + az*az);
        rotationAxes[i] = [ax/len, ay/len, az/len];
        
        // Random angular velocity (2-4 rad/s)
        angularVelocities[i] = Math.random() * 9 + 1;
        
        // Initialize identity quaternion [0, 0, 0, 1]
        quaternions[i] = new THREE.Quaternion(0, 0, 0, 1);
        targetQuaternions[i] = null;
    }
    
    // Quaternion helper functions
    function quatFromAxisAngle(axis, angle) {
        const half = angle / 2;
        const quat = new THREE.Quaternion();
        quat.setFromAxisAngle(new THREE.Vector3(...axis), angle);
        return quat;
    }
    
    function normalize(v) {
        const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if (len < 0.00001) return [0, 0, 1];
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
        const result = new THREE.Quaternion();
        result.copy(q1);
        result.slerp(q2, t);
        return result;
    }
    
    // Create quaternion from look direction (from -> to)
    function quatLookAt(from, to) {
        const forward = normalize([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
        const up = [0, 1, 0];
        const right = cross(forward, up);
        const rightNorm = normalize(right);
        const newUp = cross(rightNorm, forward);
        
        // Convert rotation matrix to quaternion
        const m00 = rightNorm[0], m01 = newUp[0], m02 = -forward[0];
        const m10 = rightNorm[1], m11 = newUp[1], m12 = -forward[1];
        const m20 = rightNorm[2], m21 = newUp[2], m22 = -forward[2];
        
        const trace = m00 + m11 + m22;
        const quat = new THREE.Quaternion();
        
        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            quat.set(
                (m21 - m12) * s,
                (m02 - m20) * s,
                (m10 - m01) * s,
                0.25 / s
            );
        } else if (m00 > m11 && m00 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            quat.set(
                0.25 * s,
                (m01 + m10) / s,
                (m02 + m20) / s,
                (m21 - m12) / s
            );
        } else if (m11 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            quat.set(
                (m01 + m10) / s,
                0.25 * s,
                (m12 + m21) / s,
                (m02 - m20) / s
            );
        } else {
            const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            quat.set(
                (m02 + m20) / s,
                (m12 + m21) / s,
                0.25 * s,
                (m10 - m01) / s
            );
        }
        return quat;
    }
    
    // Custom shader material
    const vertexResponse = await fetch('./resources/vertex.glsl');
    const vertexShader = await vertexResponse.text();
    
    const fragmentResponse = await fetch('./resources/fragment.glsl');
    const fragmentShader = await fragmentResponse.text();
    
    // Load texture
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('./resources/icon.png');
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // Create material
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            u_texture: { value: texture }
        },
        side: THREE.DoubleSide
    });
    
    // Create cube geometry and ensure normals are present
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.computeVertexNormals();
    
    const cubeScale = new THREE.Vector3(0.4, 0.4, 0.4);
    const cubeLocalPos = new Array(cubeCount);
    for (let i = 0; i < cubeCount; i++) {
        cubeLocalPos[i] = new THREE.Vector3(
            (i % 10 - 4.5) * 0.7,
            (Math.floor(i / 10) - 4.5) * 0.7,
            0
        );
    }

    const instancedMesh = new THREE.InstancedMesh(geometry, material, cubeCount);
    const instanceMatrixWork = new THREE.Matrix4();
    for (let i = 0; i < cubeCount; i++) {
        instanceMatrixWork.compose(cubeLocalPos[i], quaternions[i], cubeScale);
        instancedMesh.setMatrixAt(i, instanceMatrixWork);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);
    
    // Handle window resize
    function onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspect = width / height;
        
        if (aspect > 1) {
            camera.left = -aspect;
            camera.right = aspect;
            camera.top = 1;
            camera.bottom = -1;
        } else {
            camera.left = -1;
            camera.right = 1;
            camera.top = 1 / aspect;
            camera.bottom = -1 / aspect;
        }
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
    
    window.addEventListener('resize', onWindowResize);
    onWindowResize();
    
    function clearLookAtTargets() {
        for (let id = 0; id < cubeCount; id++) {
            targetQuaternions[id] = null;
        }
    }

    // World target + per-cube look-at quaternions from client coordinates (mouse/pointer clientX/Y).
    function updateTargetPosition(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Convert to normalized device coordinates (-1 to 1)
        const ndcX = (mouseX / rect.width) * 2 - 1;
        const ndcY = -(mouseY / rect.height) * 2 + 1;
        
        // Get aspect ratio and camera parameters
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const viewSize = 1;
        
        // Convert to world coordinates
        if (aspect > 1) {
            targetPos = [ndcX * aspect * viewSize, ndcY * viewSize, 2];
        } else {
            targetPos = [ndcX * viewSize, ndcY * viewSize / aspect, 2];
        }
        
        // Calculate look-at quaternions for all cubes
        for (let id = 0; id < cubeCount; id++) {
            const p = cubeLocalPos[id];
            targetQuaternions[id] = quatLookAt([p.x, p.y, p.z], targetPos);
        }
    }

    canvas.addEventListener(
        'pointerdown',
        function (event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            event.preventDefault();

            if (lookAtMode) {
                lookAtMode = false;
                clearLookAtTargets();
            } else {
                lookAtMode = true;
                updateTargetPosition(event);
            }
        },
        { passive: false }
    );

    canvas.addEventListener('pointermove', function (event) {
        if (!lookAtMode) return;
        if (event.pointerType === 'touch') return;
        updateTargetPosition(event);
    });

    // Render loop
    function render() {
        const elapsedTime = (Date.now() - startTime) / 1000;
        
        // Calculate delta time for smooth lerp
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;
        const lerpFactor = Math.min(deltaTime * 8, 1);
        
        for (let id = 0; id < cubeCount; id++) {
            let finalQuat;
            
            if (targetQuaternions[id] !== null) {
                finalQuat = quatSlerp(quaternions[id], targetQuaternions[id], lerpFactor);
                quaternions[id] = finalQuat;
            } else {
                const deltaAngle = angularVelocities[id] * elapsedTime;
                const rotationQuat = quatFromAxisAngle(rotationAxes[id], deltaAngle);
                finalQuat = quatSlerp(quaternions[id], rotationQuat, lerpFactor);
                quaternions[id] = finalQuat;
            }

            instanceMatrixWork.compose(cubeLocalPos[id], finalQuat, cubeScale);
            instancedMesh.setMatrixAt(id, instanceMatrixWork);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    
    requestAnimationFrame(render);
}

main();

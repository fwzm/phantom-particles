/**
 * @fileoverview 实时交互式 3D 粒子系统。
 * 采用 Three.js 进行渲染，并结合 MediaPipe 手势识别。
 * 符合 Google JavaScript 编程规范。
 * @author Antigravity
 */

class ParticleSystem {
    /**
     * @constructor
     * 初始化系统参数与组件
     */
    constructor() {
        // --- 核心配置 ---
        this.particleCount = 15000;
        this.currentModel = 'heart';
        this.baseColor = new THREE.Color(0x00f2ff);
        this.isTransitioning = false;

        // --- 交互状态 ---
        this.gestureScale = 1.0;          // 手势缩放倍率
        this.targetGestureScale = 1.0;    // 目标缩放倍率（用于平滑过渡）
        this.diffusionStrength = 1.0;      // 扩散强度

        // --- Three.js 核心组件 ---
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        // --- 缓存属性 ---
        this.positions = new Float32Array(this.particleCount * 3);
        this.targetPositions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        
        this.init();
    }

    /**
     * 初始化场景、相机和渲染器
     */
    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 25;
        this.scene.background = new THREE.Color(0x050505);

        // 创建粒子实体
        this.createParticles();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始化手势识别
        this.initHandRecognition();

        // 开始动画循环
        this.animate();
    }

    /**
     * 创建粒子几何体与材质
     */
    createParticles() {
        const geometry = new THREE.BufferGeometry();
        
        // 为每一维度生成初始位置
        this.generateModelPoints(this.currentModel, this.positions);
        // 同时也设置初始目标位置
        this.targetPositions.set(this.positions);

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        // 现代感粒子材质：使用着色器风格的 PointsMaterial
        this.material = new THREE.PointsMaterial({
            size: 0.12,
            color: this.baseColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(geometry, this.material);
        this.scene.add(this.points);

        // 初始化随机速度，用于闲置时的游走效果
        for (let i = 0; i < this.particleCount * 3; i++) {
            this.velocities[i] = (Math.random() - 0.5) * 0.02;
        }
    }

    /**
     * 生成不同模型的数学坐标点
     * @param {string} type 模型名称
     * @param {Float32Array} attribute 待写入的属性数组
     */
    generateModelPoints(type, attribute) {
        for (let i = 0; i < this.particleCount; i++) {
            let x, y, z;
            const t = Math.random() * Math.PI * 2;
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;

            switch (type) {
                case 'heart':
                    // 爱心公式
                    const angle = Math.random() * Math.PI * 2;
                    x = 16 * Math.pow(Math.sin(angle), 3);
                    y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
                    z = (Math.random() - 0.5) * 5;
                    x *= 0.6; y *= 0.6;
                    break;

                case 'flower':
                    // 玫瑰曲线变形
                    const k = 5;
                    const r = 10 * Math.sin(k * t) * Math.cos(Math.random());
                    x = r * Math.cos(t);
                    y = r * Math.sin(t);
                    z = (Math.random() - 0.5) * 3;
                    break;

                case 'saturn':
                    // 土星效果：核心球体 + 光环
                    if (i < this.particleCount * 0.4) {
                        // 球体
                        const rad = 6;
                        x = rad * Math.sqrt(1 - u * u) * Math.cos(phi);
                        y = rad * Math.sqrt(1 - u * u) * Math.sin(phi);
                        z = rad * u;
                    } else {
                        // 光环
                        const innerRadius = 8;
                        const outerRadius = 14;
                        const dist = innerRadius + Math.random() * (outerRadius - innerRadius);
                        x = dist * Math.cos(t);
                        y = (Math.random() - 0.5) * 0.5;
                        z = dist * Math.sin(t);
                    }
                    break;

                case 'fireworks':
                    // 烟花：从中心向外辐射
                    const distance = Math.random() * 15;
                    const theta = Math.acos(u);
                    x = distance * Math.sin(theta) * Math.cos(phi);
                    y = distance * Math.sin(theta) * Math.sin(phi);
                    z = distance * Math.cos(theta);
                    break;

                default:
                    x = (Math.random() - 0.5) * 20;
                    y = (Math.random() - 0.5) * 20;
                    z = (Math.random() - 0.5) * 20;
            }

            attribute[i * 3] = x;
            attribute[i * 3 + 1] = y;
            attribute[i * 3 + 2] = z;
        }
    }

    /**
     * 初始化 MediaPipe 手势识别
     */
    initHandRecognition() {
        const videoElement = document.getElementById('video-input');
        const statusText = document.querySelector('#gesture-status span');

        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                statusText.innerText = "手势交互中...";
                this.processGesture(results.multiHandLandmarks[0]);
            } else {
                statusText.innerText = "寻找手掌中...";
                this.targetGestureScale = 1.0; // 失去目标时恢复默认
            }
        });

        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        camera.start();
    }

    /**
     * 处理手势原始数据，计算张合度
     * @param {Array} landmarks 手部关键点
     */
    processGesture(landmarks) {
        // 计算食指尖(8)到手心(0)或大拇指尖(4)的距离
        // 我们这里用拇指尖和食指尖的距离来表示张合度
        const thumb = landmarks[4];
        const index = landmarks[8];

        const distance = Math.sqrt(
            Math.pow(thumb.x - index.x, 2) + 
            Math.pow(thumb.y - index.y, 2)
        );

        // 映射：距离范围约在 0.05 (握拳) 到 0.3 (张开) 之间
        // 映射到缩放倍率 0.5 到 3.0
        const minD = 0.05, maxD = 0.3;
        let scale = ((distance - minD) / (maxD - minD)) * 2.5 + 0.5;
        this.targetGestureScale = Math.max(0.3, Math.min(4.0, scale));
    }

    /**
     * 绑定 UI 事件
     */
    bindEvents() {
        // 模型切换
        document.querySelectorAll('.btn-model').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.btn-model').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const modelType = btn.getAttribute('data-model');
                this.switchToModel(modelType);
            });
        });

        // 颜色切换
        const colorInput = document.getElementById('color-input');
        const colorValueDisplay = document.getElementById('color-value');
        colorInput.addEventListener('input', (e) => {
            const hex = e.target.value;
            this.baseColor.set(hex);
            this.material.color.set(hex);
            colorValueDisplay.innerText = hex.toUpperCase();
        });

        // 全屏切换
        document.getElementById('fullscreen-toggle').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        // 窗口缩放响应
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    /**
     * 平滑切换粒子模型
     * @param {string} type 模型名称
     */
    switchToModel(type) {
        this.currentModel = type;
        this.generateModelPoints(type, this.targetPositions);
    }

    /**
     * 每一帧的渲染更新逻辑
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        const posAttr = this.points.geometry.attributes.position;
        const currentArr = posAttr.array;

        // 1. 平滑处理手势缩放 (Lerp)
        this.gestureScale += (this.targetGestureScale - this.gestureScale) * 0.1;

        // 2. 更新粒子位置
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // 目标位置乘以当前手势缩放
            const tx = this.targetPositions[i3] * this.gestureScale;
            const ty = this.targetPositions[i3 + 1] * this.gestureScale;
            const tz = this.targetPositions[i3 + 2] * this.gestureScale;

            // 缓动动画：当前位置向目标位置移动
            currentArr[i3] += (tx - currentArr[i3]) * 0.08;
            currentArr[i3 + 1] += (ty - currentArr[i3 + 1]) * 0.08;
            currentArr[i3 + 2] += (tz - currentArr[i3 + 2]) * 0.08;

            // 加入极微小的随机游走，增加灵动感
            currentArr[i3] += Math.sin(Date.now() * 0.001 + i) * 0.01;
            currentArr[i3 + 1] += Math.cos(Date.now() * 0.0012 + i) * 0.01;
        }

        posAttr.needsUpdate = true;

        // 3. 整体场景缓慢旋转
        this.points.rotation.y += 0.002;
        this.points.rotation.x += 0.001;

        this.renderer.render(this.scene, this.camera);
    }
}

// 页面加载完成后启动系统
window.onload = () => {
    window.app = new ParticleSystem();
};
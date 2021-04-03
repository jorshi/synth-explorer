

class Data {
    getData(callback) {
        $.ajax({
            url: "ajax/get_data.json"
        }).done(function (data) {
            callback(data);
        });
    }
}


class SynthBrowser {
    constructor() {

        // create WebAudio API context
        this.context = new AudioContext();

        // Create lineOut
        this.lineOut = new WebAudiox.LineOut(this.context);
        this.lineOut.volume = 0.4;
        this.currentAudioSource = null;
        this.audioSources = [];
        this.previousSampleIndex = -1;

        this.filenames = []
        this.features = []

        this.drawerWidth = $('#drawer').width();
        this.titleHeight = $('#header').height();
        this.renderWidth = window.innerWidth - this.drawerWidth;
        this.renderHeight = window.innerHeight - this.titleHeight;
        let container = document.getElementById('container');
        this.threshold = 0.1;

        // THREE initialization
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        //this.renderer.setClearColor(0xffffff, 1);
        this.renderer.setSize(this.renderWidth, this.renderHeight);
        container.appendChild(this.renderer.domElement);

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = this.threshold;
        this.mouse = new THREE.Vector2();
        this.mouseHasMoved = false;
        this.intersection = null;
        this.toggle = 0;

        this.interpolating = false;
        this.interpolatingAmount = 0;
        this.interpolationSpeed = 0.01;

        // Points
        this.pointSize = 5;
        this.pointCloud = [];
        this.spheres = [];
        this.spheresIndex = 0;

        this.target = null;
        this.target_colors = null;

        const near_plane = 2;
        const far_plane = 1000;

        // Set up camera and scene
        this.camera = new THREE.PerspectiveCamera(
            20,
            this.renderHeight / this.renderHeight,
            near_plane,
            far_plane
        );

        this.camera.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 35));

        this.data = new Data();
        this.data.getData(this.initializeData.bind(this));
    }

    initializeData(data) {
        // Data returned from AJAX call
        this.filenames = data.filenames;
        this.features = data.umapwavenet22;

        // Create points from features
        let pointCloud = this.generatePointCloud();
        pointCloud.scale.set(10, 10, 1);
        pointCloud.position.set(0, 0, 0);
        this.scene.add(pointCloud);
        this.pointCloud = [pointCloud];


        let sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        let sphereMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});

        for (let i = 0; i < 40; i++) {
            let sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            this.scene.add(sphere);
            this.spheres.push(sphere);
        }


        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this), false);

        this.onWindowResize();
        this.animate();
    }

    generatePointCloud() {
        let geometry = this.generatePointCloudGeometry();
        let material = new THREE.PointsMaterial({
            size: this.pointSize,
            vertexColors: THREE.VertexColors,
            sizeAttenuation: false
        });
        let pointCloud = new THREE.Points(geometry, material);
        return pointCloud;
    }

    generatePointCloudGeometry() {
          let geometry = new THREE.BufferGeometry();
          const {
            positions,
            colors,
          } = SynthBrowser.generatePositionsFromData(this.features);

          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeBoundingBox();

          return geometry;
    }

    animate() {

        requestAnimationFrame(this.animate.bind(this));

        if (this.interpolating) {
            this.pointCloud[0].geometry.attributes.position.needsUpdate = true;
            let positions = this.pointCloud[0].geometry.attributes.position.array;
            this.interpolatingAmount += this.interpolationSpeed;

            if (this.interpolatingAmount >= 1.0) {
                this.interpolating = false;
                for (let i = 0; i < positions.length; ++i) {
                    positions[i] = this.target[i];
                }
            } else {
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] = THREE.Math.lerp(positions[i], this.target[i], this.interpolatingAmount);
                    positions[i + 1] = THREE.Math.lerp(positions[i + 1], this.target[i + 1], this.interpolatingAmount);
                }
            }
        }

        this.render();
    }

    render() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        for (let i = 0; i < this.spheres.length; i++) {
            let sphere = this.spheres[i];
            sphere.scale.multiplyScalar(0.98);
            sphere.scale.clampScalar(0.01, 1);
        }

        let intersections = this.raycaster.intersectObjects(this.pointCloud);
        this.intersection = (intersections.length) > 0 ? intersections[0] : null;
        if (this.intersection) {
            console.log(this.intersection);
            if (this.toggle > 0.02 && this.intersection !== null && this.mouseHasMoved) {
                if (this.previousSampleIndex != this.intersection.index) {
                    let filepath = this.filenames[this.intersection.index % (this.filenames.length)];
                    this.previousSampleIndex = this.intersection.index;

                    let file = filepath;

                    WebAudiox.loadBuffer(this.context, file, function (buffer) {
                        //stopAudio();

                        // init AudioBufferSourceNode
                        let source = this.context.createBufferSource();
                        source.buffer = buffer
                        source.connect(this.lineOut.destination)

                        // start the sound now
                        source.start(0);
                        this.audioSources.push(source);
                    }.bind(this));

                    document.getElementById("filename").innerHTML = filepath;
                }

                let index = this.intersection.index;
                this.spheres[this.spheresIndex].position.copy(this.intersection.point);
                // try {
                //     let mat = spheres[spheresIndex].material.clone();
                //     mat.color.setRGB(color_presets[index].r, color_presets[index].g, color_presets[index].b);
                //     spheres[spheresIndex].material = mat;
                // } catch (_) {
                //     console.log(_)
                // }

                let scaleValue = 1;
                scaleValue = 20 / parseInt(document.getElementById("slider-zoom").value);
                this.spheres[this.spheresIndex].scale.set(scaleValue, scaleValue, scaleValue);
                this.spheresIndex = (this.spheresIndex + 1) % this.spheres.length;

                this.toggle = 0;

            }
        } else {
            this.previousSampleIndex = -1;
            // stopAudio();
        }

        this.toggle += this.clock.getDelta();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.renderWidth = window.innerWidth - this.drawerWidth;
        if (window.innerWidth <= 1024) {
            this.renderWidth = window.innerWidth;
        }
        this.renderHeight = window.innerHeight - this.titleHeight;

        this.camera.aspect = this.renderHeight / this.renderHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.renderWidth, this.renderHeight);
    }

    onDocumentMouseMove(event) {
        this.mouseHasMoved = true;
        this.titleHeight = $('#header').height();

        if (window.innerWidth >= 1024) {
            this.drawerWidth = $('#drawer').width();
            this.mouse.x = ((event.clientX - this.drawerWidth) / this.renderWidth) * 2 - 1;
        } else {
            this.mouse.x = (event.clientX / this.renderWidth) * 2 - 1;
        }
        this.mouse.y = -((event.clientY - this.titleHeight) / (this.renderHeight)) * 2 + 1;
    }

    //==========================================
    static generatePositionsFromData(data) {
        let positions = new Float32Array(data.length * 3);
        let colors = new Float32Array(data.length * 3);

        for (let i = 0; i < data.length; ++i) {
            let x = data[i]['coordinates'][0] - 0.5;
            let y = data[i]['coordinates'][1] - 0.5;
            let z = 0;

            console.log(x,y);

            positions[3 * i] = x;
            positions[3 * i + 1] = y;
            positions[3 * i + 2] = z;

            let r = 0;
            let g = 0;
            let b = 0;

            if (color_presets[i]) {
                color_presets[i].r && (r = color_presets[i].r);
                color_presets[i].g && (g = color_presets[i].g);
                color_presets[i].b && (b = color_presets[i].b);
            }
            colors[3 * i] = r;
            colors[3 * i + 1] = g;
            colors[3 * i + 2] = b;
        }

        return {
            positions,
            colors
        };
    }
}



$(document).ready(function() {
    window.synthBrowser = new SynthBrowser();
});
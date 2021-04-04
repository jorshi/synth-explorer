

class Data {
    getData(data, callback) {
        $.ajax({
            url: "ajax/get_data.json",
            data: data
        }).done(function (data) {
            callback(data);
        });
    }
}

// Audio Player Class

// Visualizer

// UserInteraction

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
        this.threshold = 0.05;

        // THREE initialization
        this.runAnimation = false;
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

        // For panning
        this.isPanning = false;
        this.startX = null;
        this.startY = null;

        this.interpolating = false;
        this.interpolatingAmount = 0;
        this.interpolationSpeed = 0.01;

        // Points
        this.pointSize = 2;
        this.pointCloud = [];
        this.spheres = [];
        this.spheresIndex = 0;

        this.target = [];
        this.target_colors = [];

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
        this.init();
    }

    init() {
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
        this.registerPanEvents();
    }

    addData(data) {
        this.runAnimation = false;
        this.data.getData(data, this.updateGraph.bind(this));
    }

    updateGraph(data, add=true) {
        // Data returned from AJAX call
        if (add) {
            this.filenames.push(...data.filenames);
            this.features.push(...data.features);
        } else {
            this.filenames = data.filenames;
            this.features = data.features;
        }

        // Create points from features
        let newPoints = this.generatePointCloud(data.features);
        newPoints.scale.set(10, 10, 1);
        newPoints.position.set(0, 0, 0);
        newPoints.name = 'sample-points';

        // Add to targets
        let positions = newPoints.geometry.getAttribute('position');
        let colors = newPoints.geometry.getAttribute('color');
        this.target.push(...positions.array);
        this.target_colors.push(...colors.array);

        // Update point cloud if it exists
        if (this.pointCloud.length === 0) {
            this.scene.add(newPoints);
            this.pointCloud = [newPoints];
        } else {
            // Existing points
            let pointCloud = this.pointCloud[0];
            let geometry = this.pointCloud[0].geometry;
            let pointsPositions = geometry.getAttribute('position');
            let pointsColors = geometry.getAttribute('color');

            // Create an updated point cloud
            let updatedPoints = new Float32Array(pointsPositions.array.length + positions.array.length);
            updatedPoints.fill(0.0);
            updatedPoints.set(pointsPositions.array);
            //updatedPoints.set(positions.array, pointsPositions.array.length);

            let updatedColors = new Float32Array(updatedPoints.length);
            updatedColors.fill(0);
            updatedColors.set(pointsColors.array);
            updatedColors.set(colors.array, pointsColors.array.length);

            geometry.setAttribute('position', new THREE.BufferAttribute(updatedPoints, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(updatedColors, 3));
            geometry.getAttribute('position').needsUpdate = true;
            geometry.needsUpdate = true;
            geometry.computeBoundingSphere();

            // Now remove the old scene
            let oldPoints = this.scene.getObjectByName('sample-points');
            this.scene.remove(oldPoints);
            this.scene.add(pointCloud);
            this.pointCloud = [pointCloud];
        }

        console.log(this.scene);

        // Start animation
        this.interpolating = true;
        this.interpolatingAmount = 0
        this.runAnimation = true;
        this.toggle = 0;
        this.animate();
    }

    generatePointCloud(data) {
        let geometry = this.generatePointCloudGeometry(data);
        let material = new THREE.PointsMaterial({
            size: this.pointSize,
            vertexColors: THREE.VertexColors,
            sizeAttenuation: false
        });
        let pointCloud = new THREE.Points(geometry, material);
        return pointCloud;
    }

    generatePointCloudGeometry(data) {
          let geometry = new THREE.BufferGeometry();
          const {
            positions,
            colors,
          } = SynthBrowser.generatePositionsFromData(data);

          // for (let i = 0; i < positions.length; i++)
          // {
          //     positions[i] = 0.0;
          // }

          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeBoundingBox();

          return geometry;
    }

    animate() {

        if (this.runAnimation)
            requestAnimationFrame(this.animate.bind(this));

        if (this.pointCloud.length === 0)
            return;

        if (this.interpolating) {
            let positions = this.pointCloud[0].geometry.getAttribute("position");
            this.interpolatingAmount += this.interpolationSpeed;

            if (this.interpolatingAmount >= 1.0) {
                this.interpolating = false;
                positions.set(this.target);
            } else {
                for (let i = 0; i < positions.count; i++) {
                    positions.setX(i, THREE.Math.lerp(positions.getX(i), this.target[3 * i], this.interpolatingAmount));
                    positions.setY(i, THREE.Math.lerp(positions.getY(i), this.target[3 * i + 1], this.interpolatingAmount));
                }
            }
            positions.needsUpdate = true;
            this.pointCloud[0].geometry.computeBoundingSphere();
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
            if (this.toggle > 0.5 && this.intersection !== null && this.mouseHasMoved) {
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

    onMove(e) {
        if (this.isPanning) {
            if (this.startX == null && this.startY == null) {
                this.startX = e.clientX;
                this.startY = e.clientY;
            } else {
                let dx = e.clientX - this.startX;
                let dy = e.clientY - this.startY;

                this.startX = e.clientX;
                this.startY = e.clientY;
                this.camera.position.x = this.camera.position.x - dx * panningSpeed;
                this.camera.position.y = this.camera.position.y + dy * panningSpeed;
            }
        }
    }

    registerPanEvents() {
        let container = document.getElementById('container');

        container.addEventListener('wheel', function (e) {
            e.preventDefault();
            e.stopPropagation();
            let step = 0;
            if (e.deltaY > 0) {
                step = 1;
            } else {
                step = -1;
            }

            let zoomControl = document.getElementById('slider-zoom');
            let min = parseInt(zoomControl.getAttribute('min'));
            let max = parseInt(zoomControl.getAttribute('max'));
            zoomControl.value = zoomControl.value - 0 + step;
            if (parseInt(zoomControl.value) < min) zoomControl.value = min;
            if (parseInt(zoomControl.value) > max) zoomControl.value = max;
            zoomControl.onchange();
        });

        // start
        container.addEventListener('mousedown', function () {
            this.isPanning = true;
        }.bind(this));
        container.addEventListener('touchstart', function () {
            this.isPanning = true;
        }.bind(this));

        container.addEventListener('mousemove', this.onMove.bind(this))
        container.addEventListener('touchmove', this.onMove.bind(this));

        // cancel
        container.addEventListener('mouseup', function () {
            this.isPanning = false;
            this.startX = null;
            this.startY = null;
        }.bind(this));
        container.addEventListener('touchend', function () {
            this.isPanning = false;
            this.startX = null;
            this.startY = null;
        }.bind(this));
    }

    //==========================================
    static generatePositionsFromData(data) {
        let positions = new Float32Array(data.length * 3);
        let colors = new Float32Array(data.length * 3);

        for (let i = 0; i < data.length; ++i) {
            let x = data[i]['coordinates'][0] - 0.5;
            let y = data[i]['coordinates'][1] - 0.5;
            let z = 0;

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
            colors[3 * i] = 255;
            colors[3 * i + 1] = 255;
            colors[3 * i + 2] = 0;
        }

        return {
            positions,
            colors
        };
    }
}


class BrowserDropArea {

    constructor(target, onDrop) {
        this.target = target
        this.onDrop = onDrop;
    }

    allowDrop(event) {
        let dataTransfer = event.originalEvent.dataTransfer;
        if (dataTransfer.types.length && dataTransfer.types[0] === this.target.type) {
            event.preventDefault();
        }
    }

    drop(event) {
        event.preventDefault();
        let data = JSON.parse(event.originalEvent.dataTransfer.getData(this.target.type));
        this.onDrop(data);
    }
}


class BrowserDragItem {

    constructor(type, dragStart) {
        this.type = type;
        this.dragStart = dragStart;
    }

    drag(event) {
        let data = this.dragStart();
        event.originalEvent.dataTransfer.setData(this.type, JSON.stringify(data));
    }
}


$(document).ready(function() {
    window.synthBrowser = new SynthBrowser();
    let synthDrag = new BrowserDragItem("synth-drag", function() {
        numSamples = $('#add-num-samples').val();
        return {synth: "Synth1B1", num_samples: numSamples};
    });
    let containerDrop = new BrowserDropArea(synthDrag, function(data) {
        window.synthBrowser.addData(data);
    });

    $('.draggable-synth').on("dragstart", synthDrag.drag.bind(synthDrag));
    $('#container').on("dragover", containerDrop.allowDrop.bind(containerDrop));
    $('#container').on("drop", containerDrop.drop.bind(containerDrop));
});

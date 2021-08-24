

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
class AudioPlayer {
    constructor() {
        // Setup for audio playback
        this.context = new AudioContext();
        this.lineOut = new WebAudiox.LineOut(this.context);
        this.lineOut.volume = 0.4;
    }

    playSound(file) {
        WebAudiox.loadBuffer(this.context, file, function (buffer) {
            // init AudioBufferSourceNode
            let source = this.context.createBufferSource();
            source.buffer = buffer
            source.connect(this.lineOut.destination)

            // start the sound now
            source.start(0);
        }.bind(this));
    }
}

// Visualizer
class Visualizer {

    constructor(audioPlayer) {

        this.player = audioPlayer;
        this.ajax = new Data();
        this.lastIndex = null;

        this.filenames = []
        this.features = []
        this.dimensions = {
            x: "mfcc_dim1",
            y: "mfcc_dim2",
            color: null
        }

        // Determine render window size
        this.drawerWidth = $('#drawer').width();
        this.titleHeight = $('#header').height();
        this.renderWidth = window.innerWidth - this.drawerWidth;
        this.renderHeight = window.innerHeight - this.titleHeight;

        // THREE initialization
        this.runAnimation = false;
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();
        this.toggle = 0;
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.renderWidth, this.renderHeight);

        // Add Renderer to the visualization container
        let container = document.getElementById('container');
        container.appendChild(this.renderer.domElement);

        // Raycaster for intersecting points
        this.threshold = 0.05;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = this.threshold;
        this.mouse = new THREE.Vector2();
        this.mouseHasMoved = false;
        this.intersection = null;

        // For panning
        this.panningSpeed = 0.01;
        this.isPanning = false;
        this.startX = null;
        this.startY = null;

        // Points & spheres
        this.pointSize = 0.5;
        this.pointCloud = [];
        this.spheres = [];
        this.spheresIndex = 0;

        // For interpolation when adding new points
        this.interpolating = false;
        this.interpolatingAmount = 0;
        this.interpolationSpeed = 0.01;
        this.target = [];
        this.target_colors = [];

        // Create spheres which show interactions
        let sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
        let sphereMaterial = new THREE.MeshBasicMaterial({color: 0x000000});

        for (let i = 0; i < 40; i++) {
            let sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            this.scene.add(sphere);
            this.spheres.push(sphere);
        }

        // Set up camera
        const near_plane = 2;
        const far_plane = 1000;
        this.camera = new THREE.PerspectiveCamera(
            20,
            this.renderHeight / this.renderHeight,
            near_plane,
            far_plane
        );
        this.camera.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, 35));

        // Add event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('mousemove', this.onDocumentMouseMove.bind(this), false);
        this.onWindowResize();
        this.registerPanEvents();

        // Start animation
        this.animate();
    }

    updateSamplePoints(data, add=true) {
        // Data returned from AJAX call
        if (add) {
            this.filenames.push(...data.filenames);
            this.features.push(...data.features);
        } else {
            this.filenames = data.filenames;
            this.features = data.features;
        }

        // Create points from features
        let newPoints = this.generatePointCloud(data.features, this.dimensions);
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

        // Start animation
        this.interpolating = true;
        this.interpolatingAmount = 0
        this.runAnimation = true;
        this.toggle = 0;
        this.animate();
    }


    updateAxis(axis, feature_id) {
        let dim;
        if (axis === 'x') {
            dim = 0;
            this.dimensions.x = feature_id;
        } else {
            dim = 1;
            this.dimensions.y = feature_id;
        }

        for (let i = 0; i < this.features.length; i++) {
            this.target[i * 3 + dim] = this.features[i][feature_id] - 0.5;
        }

        this.interpolating = true;
        this.interpolatingAmount = 0
    }

    updateColors(feature_id) {
        for (let i = 0; i < this.features.length; i++) {
            let color = new THREE.Color();
            color.setHSL(this.features[i][feature_id], 1.0, 0.6);
            this.target_colors[i * 3] = color.r;
            this.target_colors[i * 3 + 1] = color.g;
            this.target_colors[i * 3 + 2] = color.b;
        }
        this.dimensions.color = feature_id;
        this.interpolating = true;
        this.interpolatingAmount = 0;
    }

    generatePointCloud(data, dimensions) {
        let geometry = this.generatePointCloudGeometry(data, dimensions);
        let material = new THREE.PointsMaterial({
            size: this.pointSize,
            vertexColors: THREE.VertexColors,
            sizeAttenuation: true
        });
        let pointCloud = new THREE.Points(geometry, material);
        return pointCloud;
    }

    generatePointCloudGeometry(data, dimensions) {
          let geometry = new THREE.BufferGeometry();
          const {
            positions,
            colors,
          } = Visualizer.generatePositionsFromData(data, dimensions);

          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          geometry.computeBoundingBox();

          return geometry;
    }

    static generatePositionsFromData(data, dimensions) {
        let positions = new Float32Array(data.length * 3);
        let colors = new Float32Array(data.length * 3);

        for (let i = 0; i < data.length; ++i) {
            let x = data[i][dimensions.x] - 0.5;
            let y = data[i][dimensions.y] - 0.5;
            let z = 0;

            positions[3 * i] = x;
            positions[3 * i + 1] = y;
            positions[3 * i + 2] = z;

            let r = 255;
            let g = 255;
            let b = 0;

            if (dimensions.color !== null) {
                let color = new THREE.Color();
                color.setHSL(data[i][dimensions.color], 1.0, 0.6);
                r = color.r;
                g = color.g;
                b = color.b;
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

    animate() {
        if (this.runAnimation)
            requestAnimationFrame(this.animate.bind(this));

        if (this.pointCloud.length === 0)
            return;

        if (this.interpolating) {
            let positions = this.pointCloud[0].geometry.getAttribute("position");
            let colors = this.pointCloud[0].geometry.getAttribute("color");
            this.interpolatingAmount += this.interpolationSpeed;
            if (this.interpolatingAmount >= 1.0) {
                this.interpolating = false;
                positions.set(this.target);
                colors.set(this.target_colors);
            } else {
                for (let i = 0; i < positions.count; i++) {
                    positions.setX(i, THREE.Math.lerp(positions.getX(i), this.target[3 * i], this.interpolatingAmount));
                    positions.setY(i, THREE.Math.lerp(positions.getY(i), this.target[3 * i + 1], this.interpolatingAmount));
                }
                for (let j = 0; j < colors.count; j++) {
                    let color = new THREE.Color();
                    color.setRGB(colors.array[j * 3], colors.array[j * 3 + 1], colors.array[j * 3 + 2]);
                    let newColor = new THREE.Color();
                    newColor.setRGB(this.target_colors[j * 3], this.target_colors[j * 3 + 1], this.target_colors[j * 3 + 2]);
                    color.lerp(newColor, this.interpolatingAmount);
                    colors.array[j * 3] = color.r;
                    colors.array[j * 3 + 1] = color.g;
                    colors.array[j * 3 + 2] = color.b;
                }
            }
            positions.needsUpdate = true;
            colors.needsUpdate = true;
            this.pointCloud[0].geometry.computeBoundingSphere();
        }

        this.render();
    }

    render() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        for (let i = 0; i < this.spheres.length; i++) {
            let sphere = this.spheres[i];
            sphere.scale.multiplyScalar(0.99);
            if (sphere.scale < 0.1) {
                sphere.scale = 0.0;
            }
            //sphere.scale.clampScalar(0.001, 1);
        }

        let intersections = this.raycaster.intersectObjects(this.pointCloud);
        this.intersection = (intersections.length) > 0 ? intersections[0] : null;
        if (this.intersection) {
            if (this.toggle > 0.1 && this.intersection !== null && this.mouseHasMoved) {
                if (this.previousSampleIndex != this.intersection.index) {
                    let filepath = this.filenames[this.intersection.index % (this.filenames.length)];
                    this.previousSampleIndex = this.intersection.index;
                    this.lastIndex = this.intersection.index;

                    let file = filepath;
                    this.player.playSound(file);

                    document.getElementById("filename").innerHTML = filepath;
                }

                let index = this.intersection.index;
                this.spheres[this.spheresIndex].position.copy(this.intersection.point);
                let color = this.pointCloud[0].geometry.getAttribute("color");

                let mat = this.spheres[this.spheresIndex].material.clone();
                mat.color.setRGB(color.array[3 * index], color.array[3 * index + 1], color.array[3 * index + 2]);
                this.spheres[this.spheresIndex].material = mat;

                let scaleValue = 1;
                scaleValue = 20 / parseInt(document.getElementById("slider-zoom").value);
                this.spheres[this.spheresIndex].scale.set(scaleValue, scaleValue, scaleValue);
                this.spheresIndex = (this.spheresIndex + 1) % this.spheres.length;

                this.toggle = 0;

            }
        } else {
            this.previousSampleIndex = -1;
        }

        this.toggle += this.clock.getDelta();
        this.renderer.render(this.scene, this.camera);
    }

    // ======================================================================
    // Handle User Interactions
    // ======================================================================
    updateZoom() {
        let z = parseInt(document.getElementById("slider-zoom").value);

        // camera.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 60 / z));
        this.camera.position.z = 700 / z;
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
                this.camera.position.x = this.camera.position.x - dx * this.panningSpeed * (this.camera.position.z / 50.0);
                this.camera.position.y = this.camera.position.y + dy * this.panningSpeed * (this.camera.position.z / 50.0);
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
                step = -5;
            } else {
                step = 5;
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

/**
 * SynthBrowser
 *
 * Main class for interacting with the sample data and visualizer
 */
class SynthBrowser {

    constructor() {
        this.player = new AudioPlayer();
        this.ajax = new Data();
        this.visualizer = new Visualizer(this.player);
        this.featureNames = {};

        this.setup_feature_drop();
        this.setupKeyboard();

        this.savedIndices = new Set();
    }

    setup_feature_drop() {
        let target = {type: "feature-drag"};

        // Y-axis drop area
        let featureDropY = new BrowserDropArea(target, (data) => {
            this.visualizer.updateAxis('y', data.feature_id);
        });
        $('#drag-y-axis').hide();
        $('#drag-y-axis').on("dragover", featureDropY.allowDrop.bind(featureDropY));
        $('#drag-y-axis').on("drop", featureDropY.drop.bind(featureDropY));

        // X-axis drop area
        let featureDropX = new BrowserDropArea(target, (data) => {
            this.visualizer.updateAxis('x', data.feature_id);
        })
        $('#drag-y-axis').hide();
        $('#drag-x-axis').on("dragover", featureDropX.allowDrop.bind(featureDropX));
        $('#drag-x-axis').on("drop", featureDropX.drop.bind(featureDropX));

        // Colour drop area
        // X-axis drop area
        let featureDropColor = new BrowserDropArea(target, (data) => {
            this.visualizer.updateColors(data.feature_id);
        })
        $('#drag-color').hide();
        $('#drag-color').on("dragover", featureDropColor.allowDrop.bind(featureDropColor));
        $('#drag-color').on("drop", featureDropColor.drop.bind(featureDropColor));
    }

    requestSamples(request) {
        this.visualizer.runAnimation = false;
        this.ajax.getData(request, function(data) {
            this.updateFeatureList(data.feature_names, data.feature_desc);
            this.visualizer.updateSamplePoints(data);
        }.bind(this));
    }

    updateFeatureList(featureNames, tooltips) {
        this.featureNames = {
            ...this.featureNames,
            ...featureNames,
        };
        let featureBlock = $('#feature-proto').hide();
        let featureList = $('#feature-list');

        // Update list of features
        for (const [key, value] of Object.entries(this.featureNames)) {
            if ($('#' + key).length === 0) {
                let container = $("<md-container style=\"overflow:visible\"></md-container>");
                let newFeatureBlock = featureBlock.clone(true);
                newFeatureBlock.attr("id", key);
                newFeatureBlock.text(value);
                newFeatureBlock.show();
                this.create_feature_drag(newFeatureBlock, key);
                container.append(newFeatureBlock);
                container.append("<div class=\"mdl-tooltip\" for=\"" + key + "\">" + tooltips[key] + "</div>");
                featureList.append(container);
            }
        }
        $('#feature-info').hide();
        $('#drag-feature-info').show();
        componentHandler.upgradeDom();
    }

    create_feature_drag(object, id) {
        let featureDrag = new BrowserDragItem("feature-drag", () => {
            // Show the area where this can be dropped
            SynthBrowser.show_axis_drop();
            return {feature_id: id};
        });
        object.on("dragstart", featureDrag.drag.bind(featureDrag));
        object.on("dragend", SynthBrowser.hide_axis_drop);
    }

    static show_axis_drop() {
        $('#drag-y-axis').addClass("draggable-y-axis").show();
        $('#drag-x-axis').addClass("draggable-x-axis").show();
        $('#drag-color').addClass("draggable-color").show();
    }

    static hide_axis_drop() {
        $('#drag-y-axis').removeClass("draggable-y-axis").hide();
        $('#drag-x-axis').removeClass("draggable-x-axis").hide();
        $('#drag-color').removeClass("draggable-color").hide();
    }

    // Save
    setupKeyboard() {
        document.addEventListener('keydown', function(event) {
            if (event.code == 'KeyS') {
                this.savedIndices.add(this.visualizer.lastIndex);
                $('#num-files-saved').text(this.savedIndices.size);
            }
            console.log(event.code);
        }.bind(this));
    }
}


$(document).ready(function() {
    window.synthBrowser = new SynthBrowser();
    $('#drag-feature-info').hide();

    // Synth Samples Drag
    let synthDrag = new BrowserDragItem("synth-drag", function() {
        numSamples = $('#add-num-samples').val();
        return {synth: "Synth1B1", num_samples: numSamples};
    });
    let containerDrop = new BrowserDropArea(synthDrag, function(data) {
        window.synthBrowser.requestSamples(data);
    });

    $('.synth-drag').on("dragstart", synthDrag.drag.bind(synthDrag));
    $('#container').on("dragover", containerDrop.allowDrop.bind(containerDrop));
    $('#container').on("drop", containerDrop.drop.bind(containerDrop));


});

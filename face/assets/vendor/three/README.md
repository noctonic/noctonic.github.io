# Local Three.js Vendor Files

This project expects Three.js to be vendored locally (no CDN usage).

Expected file locations:

- `/Users/user/projects/face/assets/vendor/three/build/three.module.js`
- `/Users/user/projects/face/assets/vendor/three/examples/jsm/loaders/GLTFLoader.js`
- `/Users/user/projects/face/assets/vendor/three/examples/jsm/controls/OrbitControls.js`
- `/Users/user/projects/face/assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js`

If these files are missing, `src/main.js` will show an error in the UI status line.

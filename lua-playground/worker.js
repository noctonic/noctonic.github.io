var worker;
var stackWorker;

function startWasi(elemId, workerFileName, workerImageNamePrefix, workerImageChunks) {
    const xterm = new Terminal({
        rows:8,
        cols:160,
        fontFamily: '"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace',
        fontSize: 20,
        theme: {
            background: '#002b36',
            foreground: '#00d265',
            cursor: '#93a1a1',
            selection: '#073642',
        }
    });
    xterm.open(document.getElementById(elemId));

    const { master, slave } = openpty();
    var termios = slave.ioctl("TCGETS");
    termios.iflag &= ~(/*IGNBRK | BRKINT | PARMRK |*/ ISTRIP | INLCR | IGNCR | ICRNL | IXON);
    termios.oflag &= ~(OPOST);
    termios.lflag &= ~(ECHO | ECHONL | ICANON | ISIG | IEXTEN);
    //termios.cflag &= ~(CSIZE | PARENB);
    //termios.cflag |= CS8;
    slave.ioctl("TCSETS", new Termios(termios.iflag, termios.oflag, termios.cflag, termios.lflag, termios.cc));
    xterm.loadAddon(master);
    worker = new Worker(workerFileName);

    var nwStack;
    var netParam = getNetParam();
    if (!netParam || netParam.mode != 'none') {
        stackWorker = new Worker("/lua-playground/src/stack-worker.js"+location.search);
        nwStack = newStack(worker, workerImageNamePrefix, workerImageChunks, stackWorker, location.origin + "/lua-playground/src/c2w-net-proxy.wasm");
    }
    if (!nwStack) {
        worker.postMessage({type: "init", imagename: workerImageNamePrefix, chunks: workerImageChunks});
    }
    new TtyServer(slave).start(worker, nwStack);
    return { master, slave };
}

function getNetParam() {
    var vars = location.search.substring(1).split('&');
    for (var i = 0; i < vars.length; i++) {
        var kv = vars[i].split('=');
        if (decodeURIComponent(kv[0]) == 'net') {
            return {
                mode: kv[1],
                param: kv[2],
            };
        }
    }
    return {mode: 'none'};
}

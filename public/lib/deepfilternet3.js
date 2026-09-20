let wasm;

const heap = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];
    heap[idx] = obj;
    return idx;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

class DfState {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(DfState.prototype);
        obj.__wbg_ptr = ptr;
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_dfstate_free(ptr, 0);
    }

    constructor(tar_bytes) {
        const ptr0 = passArray8ToWasm0(tar_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.dfstate_new(ptr0, len0);
        this.__wbg_ptr = ret >>> 0;
        return this;
    }

    set_atten_lim(lim) {
        wasm.dfstate_set_atten_lim(this.__wbg_ptr, lim);
    }

    process(frame) {
        const ptr0 = passArrayF32ToWasm0(frame, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.dfstate_process(this.__wbg_ptr, ptr0, len0);
        var v2 = getFloat32ArrayMemory0().subarray(ret / 4, ret / 4 + len0).slice();
        wasm.__wbindgen_free(ret, len0 * 4, 4);
        return v2;
    }
}

async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;

    if (typeof input === 'undefined') {
        input = '/model/v3/pkg/df_bg.wasm';
    }

    const imports = __wbg_get_imports();

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
        input = fetch(input);
    }

    const { instance } = await WebAssembly.instantiateStreaming(input, imports).catch(async () => {
        const resp = await fetch('/model/v3/pkg/df_bg.wasm');
        const bytes = await resp.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    });

    wasm = instance.exports;
    return wasm;
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    
    // تابع مورد نیاز که ارور داده بود
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };

    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return addHeapObject(ret);
    };

    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

if (typeof window !== 'undefined') {
    window.DfInit = __wbg_init;
    window.DfState = DfState;
}

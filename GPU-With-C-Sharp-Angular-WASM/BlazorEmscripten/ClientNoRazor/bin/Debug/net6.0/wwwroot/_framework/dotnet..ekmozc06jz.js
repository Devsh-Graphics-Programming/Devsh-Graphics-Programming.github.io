

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

var nodeFS;
var nodePath;

if (ENVIRONMENT_IS_NODE) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = require('path').dirname(scriptDirectory) + '/';
  } else {
    scriptDirectory = __dirname + '/';
  }

// include: node_shell_read.js


read_ = function shell_read(filename, binary) {
  if (!nodeFS) nodeFS = require('fs');
  if (!nodePath) nodePath = require('path');
  filename = nodePath['normalize'](filename);
  return nodeFS['readFileSync'](filename, binary ? null : 'utf8');
};

readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
    ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
};

// end include: node_shell_read.js
  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };

} else
if (ENVIRONMENT_IS_SHELL) {

  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = /** @type{!Console} */({});
    console.log = /** @type{!function(this:Console, ...*): undefined} */ (print);
    console.warn = console.error = /** @type{!function(this:Console, ...*): undefined} */ (typeof printErr !== 'undefined' ? printErr : print);
  }

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document !== 'undefined' && document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }

  // Differentiate the Web Worker from the Node Worker case, as reading must
  // be done differently.
  {

// include: web_or_worker_shell_read.js


  read_ = function(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = function(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

// end include: web_or_worker_shell_read.js
  }

  setWindowTitle = function(title) { document.title = title };
} else
{
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.

if (Module['arguments']) arguments_ = Module['arguments'];

if (Module['thisProgram']) thisProgram = Module['thisProgram'];

if (Module['quit']) quit_ = Module['quit'];

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message




var STACK_ALIGN = 16;

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = Number(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

// include: runtime_functions.js


// Wraps a JS function as a wasm function with a given signature.
function convertJsFunctionToWasm(func, sig) {

  // If the type reflection proposal is available, use the new
  // "WebAssembly.Function" constructor.
  // Otherwise, construct a minimal wasm module importing the JS function and
  // re-exporting it.
  if (typeof WebAssembly.Function === "function") {
    var typeNames = {
      'i': 'i32',
      'j': 'i64',
      'f': 'f32',
      'd': 'f64'
    };
    var type = {
      parameters: [],
      results: sig[0] == 'v' ? [] : [typeNames[sig[0]]]
    };
    for (var i = 1; i < sig.length; ++i) {
      type.parameters.push(typeNames[sig[i]]);
    }
    return new WebAssembly.Function(type, func);
  }

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    'e': {
      'f': func
    }
  });
  var wrappedFunc = instance.exports['f'];
  return wrappedFunc;
}

var freeTableIndexes = [];

// Weak map of functions in the table to their indexes, created on first use.
var functionsInTableMap;

function getEmptyTableSlot() {
  // Reuse a free index if there is one, otherwise grow.
  if (freeTableIndexes.length) {
    return freeTableIndexes.pop();
  }
  // Grow the table
  try {
    wasmTable.grow(1);
  } catch (err) {
    if (!(err instanceof RangeError)) {
      throw err;
    }
    throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
  }
  return wasmTable.length - 1;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  // Check if the function is already in the table, to ensure each function
  // gets a unique index. First, create the map if this is the first use.
  if (!functionsInTableMap) {
    functionsInTableMap = new WeakMap();
    for (var i = 0; i < wasmTable.length; i++) {
      var item = wasmTable.get(i);
      // Ignore null values.
      if (item) {
        functionsInTableMap.set(item, i);
      }
    }
  }
  if (functionsInTableMap.has(func)) {
    return functionsInTableMap.get(func);
  }

  // It's not in the table, add it now.

  var ret = getEmptyTableSlot();

  // Set the new value.
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    wasmTable.set(ret, func);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
    var wrapped = convertJsFunctionToWasm(func, sig);
    wasmTable.set(ret, wrapped);
  }

  functionsInTableMap.set(func, ret);

  return ret;
}

function removeFunction(index) {
  functionsInTableMap.delete(wasmTable.get(index));
  freeTableIndexes.push(index);
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {

  return addFunctionWasm(func, sig);
}

// end include: runtime_functions.js
// include: runtime_debug.js


// end include: runtime_debug.js
var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
var noExitRuntime = Module['noExitRuntime'] || true;

if (typeof WebAssembly !== 'object') {
  abort('no native wasm support detected');
}

// include: runtime_safe_heap.js


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @param {number} ptr
    @param {number} value
    @param {string} type
    @param {number|boolean=} noSafe */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': HEAP8[((ptr)>>0)] = value; break;
      case 'i8': HEAP8[((ptr)>>0)] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)] = tempI64[0],HEAP32[(((ptr)+(4))>>2)] = tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @param {number} ptr
    @param {string} type
    @param {number|boolean=} noSafe */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch (type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

// end include: runtime_safe_heap.js
// Wasm globals

var wasmMemory;

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
/** @param {string|null=} returnType
    @param {Array=} argTypes
    @param {Arguments|Array=} args
    @param {Object=} opts */
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  var asyncMode = opts && opts.async;
  var runningAsync = typeof Asyncify === 'object' && Asyncify.currData;
  var prevRunningAsync = typeof Asyncify === 'object' && Asyncify.asyncFinalizers.length > 0;
  // Check if we started an async operation just now.
  if (runningAsync && !prevRunningAsync) {
    // If so, the WASM function ran asynchronous and unwound its stack.
    // We need to return a Promise that resolves the return value
    // once the stack is rewound and execution finishes.
    return new Promise(function(resolve) {
      Asyncify.asyncFinalizers.push(function(ret) {
        if (stack !== 0) stackRestore(stack);
        resolve(convertReturnValue(ret));
      });
    });
  }

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  // If this is an async ccall, ensure we return a promise
  if (opts && opts.async) return Promise.resolve(ret);
  return ret;
}

/** @param {string=} returnType
    @param {Array=} argTypes
    @param {Object=} opts */
function cwrap(ident, returnType, argTypes, opts) {
  argTypes = argTypes || [];
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs && !opts) {
    return getCFunc(ident);
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((Uint8Array|Array<number>), number)} */
function allocate(slab, allocator) {
  var ret;

  if (allocator == ALLOC_STACK) {
    ret = stackAlloc(slab.length);
  } else {
    ret = _malloc(slab.length);
  }

  if (slab.subarray || slab.slice) {
    HEAPU8.set(/** @type {!Uint8Array} */(slab), ret);
  } else {
    HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
}

// include: runtime_strings.js


// runtime_strings.js: Strings related runtime functions that are part of both MINIMAL_RUNTIME and regular runtime.

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(heap, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = heap[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = heap[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = heap[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   heap: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 0xC0 | (u >> 6);
      heap[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 0xE0 | (u >> 12);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 0xF0 | (u >> 18);
      heap[outIdx++] = 0x80 | ((u >> 12) & 63);
      heap[outIdx++] = 0x80 | ((u >> 6) & 63);
      heap[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}

// end include: runtime_strings.js
// include: runtime_strings_extra.js


// runtime_strings_extra.js: Strings related runtime functions that are available only in regular runtime.

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;

function UTF16ToString(ptr, maxBytesToRead) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  var maxIdx = idx + maxBytesToRead / 2;
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var str = '';

    // If maxBytesToRead is not passed explicitly, it will be undefined, and the for-loop's condition
    // will always evaluate to true. The loop is then terminated on the first null char.
    for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) break;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }

    return str;
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)] = codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr, maxBytesToRead) {
  var i = 0;

  var str = '';
  // If maxBytesToRead is not passed explicitly, it will be undefined, and this
  // will always evaluate to true. This saves on code size.
  while (!(i >= maxBytesToRead / 4)) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0) break;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
  return str;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)] = 0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated
    @param {boolean=} dontAddNull */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}

/** @param {boolean=} dontAddNull */
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)] = str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)] = 0;
}

// end include: runtime_strings_extra.js
// Memory management

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

var HEAP64;
var HEAPU64;

function updateGlobalBufferAndViews(buf) {
  buffer = buf;
  Module['HEAP8'] = HEAP8 = new Int8Array(buf);
  Module['HEAP16'] = HEAP16 = new Int16Array(buf);
  Module['HEAP32'] = HEAP32 = new Int32Array(buf);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buf);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buf);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buf);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buf);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buf);
  Module['HEAP64'] = HEAP64 = new BigInt64Array(buf);
  Module['HEAPU64'] = HEAPU64 = new BigUint64Array(buf);
}

var TOTAL_STACK = 5242880;

var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 536870912;

// include: runtime_init_table.js
// In regular non-RELOCATABLE mode the table is exported
// from the wasm module and this will be assigned once
// the exports are available.
var wasmTable;

// end include: runtime_init_table.js
// include: runtime_stack_check.js


// end include: runtime_stack_check.js
// include: runtime_assertions.js


// end include: runtime_assertions.js
var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;

function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  runtimeInitialized = true;

  if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
TTY.init();
SOCKFS.root = FS.mount(SOCKFS, {}, null);
  callRuntimeCallbacks(__ATINIT__);
}

function exitRuntime() {
  runtimeExited = true;
}

function postRun() {

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data

/** @param {string|number=} what */
function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  what = 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// {{MEM_INITIALIZER}}

// include: memoryprofiler.js


// end include: memoryprofiler.js
// include: URIUtils.js


// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  // Prefix of data URIs emitted by SINGLE_FILE and related options.
  return filename.startsWith(dataURIPrefix);
}

// Indicates whether filename is delivered via file protocol (as opposed to http/https)
function isFileURI(filename) {
  return filename.startsWith('file://');
}

// end include: URIUtils.js
  var wasmBinaryFile = 'dotnet.wasm';
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }

function getBinary(file) {
  try {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // If we don't have the binary yet, try to to load it asynchronously.
  // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
  // See https://github.com/github/fetch/pull/92#issuecomment-140665932
  // Cordova or Electron apps are typically loaded from a file:// url.
  // So use fetch if it is available and the url is not a file, otherwise fall back to XHR.
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
    if (typeof fetch === 'function'
      && !isFileURI(wasmBinaryFile)
    ) {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
          return getBinary(wasmBinaryFile);
      });
    }
    else {
      if (readAsync) {
        // fetch is not available or url is file => try XHR (readAsync uses XHR internally)
        return new Promise(function(resolve, reject) {
          readAsync(wasmBinaryFile, function(response) { resolve(new Uint8Array(/** @type{!ArrayBuffer} */(response))) }, reject)
        });
      }
    }
  }

  // Otherwise, getBinary should be able to get it synchronously
  return Promise.resolve().then(function() { return getBinary(wasmBinaryFile); });
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm() {
  // prepare imports
  var info = {
    'env': asmLibraryArg,
    'wasi_snapshot_preview1': asmLibraryArg,
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/
  function receiveInstance(instance, module) {
    var exports = instance.exports;

    exports = Asyncify.instrumentWasmExports(exports);

    Module['asm'] = exports;

    wasmMemory = Module['asm']['memory'];
    updateGlobalBufferAndViews(wasmMemory.buffer);

    wasmTable = Module['asm']['__indirect_function_table'];

    addOnInit(Module['asm']['__wasm_call_ctors']);

    removeRunDependency('wasm-instantiate');
  }
  // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');

  // Prefer streaming instantiation if available.
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(result['instance']);
  }

  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      var result = WebAssembly.instantiate(binary, info);
      return result;
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);

      abort(reason);
    });
  }

  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiationResult, function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            return instantiateArrayBuffer(receiveInstantiationResult);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiationResult);
    }
  }

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      exports = Asyncify.instrumentWasmExports(exports);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = {
  588356: function($0, $1) {var level = $0; var message = Module.UTF8ToString ($1); var namespace = "Debugger.Debug"; if (MONO["logging"] && MONO.logging["debugger"]) { MONO.logging.debugger (level, message); return; } console.debug("%s: %s", namespace, message);},  
 588596: function($0, $1, $2, $3) {MONO.mono_wasm_add_dbg_command_received ($0, $1, $2, $3);},  
 588658: function($0, $1, $2, $3) {MONO.mono_wasm_add_dbg_command_received ($0, $1, $2, $3);},  
 588720: function($0, $1, $2, $3) {MONO.mono_wasm_add_dbg_command_received ($0, $1, $2, $3);},  
 588782: function($0, $1, $2, $3) {MONO.mono_wasm_add_dbg_command_received ($0, $1, $2, $3);},  
 588844: function($0, $1) {MONO.mono_wasm_add_dbg_command_received (1, 0, $0, $1);},  
 588904: function($0, $1) {MONO.string_decoder.decode($0, $0 + $1, true);},  
 588955: function($0, $1, $2) {var js_str = MONO.string_decoder.copy ($0); try { var res = eval (js_str); setValue ($2, 0, "i32"); if (res === null || res === undefined) return 0; else res = res.toString (); } catch (e) { res = e.toString(); setValue ($2, 1, "i32"); if (res === null || res === undefined) res = "unknown exception"; var stack = e.stack; if (stack) { if (stack.startsWith(res)) res = stack; else res += "\n" + stack; } } var buff = Module._malloc((res.length + 1) * 2); stringToUTF16 (res, buff, (res.length + 1) * 2); setValue ($1, res.length, "i32"); return buff;},  
 589510: function($0, $1, $2, $3, $4) {var log_level = $0; var message = Module.UTF8ToString ($1); var isFatal = $2; var domain = Module.UTF8ToString ($3); var dataPtr = $4; if (MONO["logging"] && MONO.logging["trace"]) { MONO.logging.trace(domain, log_level, message, isFatal, dataPtr); return; } if (isFatal) console.trace (message); switch (Module.UTF8ToString ($0)) { case "critical": case "error": console.error (message); break; case "warning": console.warn (message); break; case "message": console.log (message); break; case "info": console.info (message); break; case "debug": console.debug (message); break; default: console.log (message); break; }}
};
function compile_function(snippet_ptr,len,is_exception){ try { var data = MONO.string_decoder.decode (snippet_ptr, snippet_ptr + len); var wrapper = '(function () { ' + data + ' })'; var funcFactory = eval(wrapper); var func = funcFactory(); if (typeof func !== 'function') { throw new Error('Code must return an instance of a JavaScript function. ' + 'Please use `return` statement to return a function.'); } setValue (is_exception, 0, "i32"); return BINDING.js_to_mono_obj (func, true); } catch (e) { res = e.toString (); setValue (is_exception, 1, "i32"); if (res === null || res === undefined) res = "unknown exception"; return BINDING.js_to_mono_obj (res, true); } }





  function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
          callback(Module); // Pass the module as the first argument.
          continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
          if (callback.arg === undefined) {
            (function() {  dynCall_v.call(null, func); })();
          } else {
            (function(a1) {  dynCall_vi.apply(null, [func, a1]); })(callback.arg);
          }
        } else {
          func(callback.arg === undefined ? null : callback.arg);
        }
      }
    }

  function demangle(func) {
      return func;
    }

  function demangleAll(text) {
      var regex =
        /\b_Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }

  function jsStackTrace() {
      var error = new Error();
      if (!error.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error();
        } catch(e) {
          error = e;
        }
        if (!error.stack) {
          return '(no stack trace available)';
        }
      }
      return error.stack.toString();
    }

  var runtimeKeepaliveCounter=0;
  function keepRuntimeAlive() {
      return noExitRuntime || runtimeKeepaliveCounter > 0;
    }

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }

  function ___assert_fail(condition, filename, line, func) {
      abort('Assertion failed: ' + UTF8ToString(condition) + ', at: ' + [filename ? UTF8ToString(filename) : 'unknown filename', line, func ? UTF8ToString(func) : 'unknown function']);
    }

  var _emscripten_get_now;if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else _emscripten_get_now = function() { return performance.now(); }
  ;
  
  var _emscripten_get_now_is_monotonic=true;;
  
  function setErrNo(value) {
      HEAP32[((___errno_location())>>2)] = value;
      return value;
    }
  function _clock_gettime(clk_id, tp) {
      // int clock_gettime(clockid_t clk_id, struct timespec *tp);
      var now;
      if (clk_id === 0) {
        now = Date.now();
      } else if ((clk_id === 1 || clk_id === 4) && _emscripten_get_now_is_monotonic) {
        now = _emscripten_get_now();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[((tp)>>2)] = (now/1000)|0; // seconds
      HEAP32[(((tp)+(4))>>2)] = ((now % 1000)*1000*1000)|0; // nanoseconds
      return 0;
    }
  function ___clock_gettime(a0,a1
  ) {
  return _clock_gettime(a0,a1);
  }

  var ExceptionInfoAttrs={DESTRUCTOR_OFFSET:0,REFCOUNT_OFFSET:4,TYPE_OFFSET:8,CAUGHT_OFFSET:12,RETHROWN_OFFSET:13,SIZE:16};
  function ___cxa_allocate_exception(size) {
      // Thrown object is prepended by exception metadata block
      return _malloc(size + ExceptionInfoAttrs.SIZE) + ExceptionInfoAttrs.SIZE;
    }

  function _atexit(func, arg) {
    }
  function ___cxa_atexit(a0,a1
  ) {
  return _atexit(a0,a1);
  }

  function ExceptionInfo(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - ExceptionInfoAttrs.SIZE;
  
      this.set_type = function(type) {
        HEAP32[(((this.ptr)+(ExceptionInfoAttrs.TYPE_OFFSET))>>2)] = type;
      };
  
      this.get_type = function() {
        return HEAP32[(((this.ptr)+(ExceptionInfoAttrs.TYPE_OFFSET))>>2)];
      };
  
      this.set_destructor = function(destructor) {
        HEAP32[(((this.ptr)+(ExceptionInfoAttrs.DESTRUCTOR_OFFSET))>>2)] = destructor;
      };
  
      this.get_destructor = function() {
        return HEAP32[(((this.ptr)+(ExceptionInfoAttrs.DESTRUCTOR_OFFSET))>>2)];
      };
  
      this.set_refcount = function(refcount) {
        HEAP32[(((this.ptr)+(ExceptionInfoAttrs.REFCOUNT_OFFSET))>>2)] = refcount;
      };
  
      this.set_caught = function (caught) {
        caught = caught ? 1 : 0;
        HEAP8[(((this.ptr)+(ExceptionInfoAttrs.CAUGHT_OFFSET))>>0)] = caught;
      };
  
      this.get_caught = function () {
        return HEAP8[(((this.ptr)+(ExceptionInfoAttrs.CAUGHT_OFFSET))>>0)] != 0;
      };
  
      this.set_rethrown = function (rethrown) {
        rethrown = rethrown ? 1 : 0;
        HEAP8[(((this.ptr)+(ExceptionInfoAttrs.RETHROWN_OFFSET))>>0)] = rethrown;
      };
  
      this.get_rethrown = function () {
        return HEAP8[(((this.ptr)+(ExceptionInfoAttrs.RETHROWN_OFFSET))>>0)] != 0;
      };
  
      // Initialize native structure fields. Should be called once after allocated.
      this.init = function(type, destructor) {
        this.set_type(type);
        this.set_destructor(destructor);
        this.set_refcount(0);
        this.set_caught(false);
        this.set_rethrown(false);
      }
  
      this.add_ref = function() {
        var value = HEAP32[(((this.ptr)+(ExceptionInfoAttrs.REFCOUNT_OFFSET))>>2)];
        HEAP32[(((this.ptr)+(ExceptionInfoAttrs.REFCOUNT_OFFSET))>>2)] = value + 1;
      };
  
      // Returns true if last reference released.
      this.release_ref = function() {
        var prev = HEAP32[(((this.ptr)+(ExceptionInfoAttrs.REFCOUNT_OFFSET))>>2)];
        HEAP32[(((this.ptr)+(ExceptionInfoAttrs.REFCOUNT_OFFSET))>>2)] = prev - 1;
        return prev === 1;
      };
    }
  function CatchInfo(ptr) {
  
      this.free = function() {
        _free(this.ptr);
        this.ptr = 0;
      };
  
      this.set_base_ptr = function(basePtr) {
        HEAP32[((this.ptr)>>2)] = basePtr;
      };
  
      this.get_base_ptr = function() {
        return HEAP32[((this.ptr)>>2)];
      };
  
      this.set_adjusted_ptr = function(adjustedPtr) {
        var ptrSize = 4;
        HEAP32[(((this.ptr)+(ptrSize))>>2)] = adjustedPtr;
      };
  
      this.get_adjusted_ptr = function() {
        var ptrSize = 4;
        return HEAP32[(((this.ptr)+(ptrSize))>>2)];
      };
  
      // Get pointer which is expected to be received by catch clause in C++ code. It may be adjusted
      // when the pointer is casted to some of the exception object base classes (e.g. when virtual
      // inheritance is used). When a pointer is thrown this method should return the thrown pointer
      // itself.
      this.get_exception_ptr = function() {
        // Work around a fastcomp bug, this code is still included for some reason in a build without
        // exceptions support.
        var isPointer = ___cxa_is_pointer_type(
          this.get_exception_info().get_type());
        if (isPointer) {
          return HEAP32[((this.get_base_ptr())>>2)];
        }
        var adjusted = this.get_adjusted_ptr();
        if (adjusted !== 0) return adjusted;
        return this.get_base_ptr();
      };
  
      this.get_exception_info = function() {
        return new ExceptionInfo(this.get_base_ptr());
      };
  
      if (ptr === undefined) {
        this.ptr = _malloc(8);
        this.set_adjusted_ptr(0);
      } else {
        this.ptr = ptr;
      }
    }
  
  var exceptionCaught= [];
  
  function exception_addRef(info) {
      info.add_ref();
    }
  
  var uncaughtExceptionCount=0;
  function ___cxa_begin_catch(ptr) {
      var catchInfo = new CatchInfo(ptr);
      var info = catchInfo.get_exception_info();
      if (!info.get_caught()) {
        info.set_caught(true);
        uncaughtExceptionCount--;
      }
      info.set_rethrown(false);
      exceptionCaught.push(catchInfo);
      exception_addRef(info);
      return catchInfo.get_exception_ptr();
    }

  var exceptionLast=0;
  
  function ___cxa_free_exception(ptr) {
        return _free(new ExceptionInfo(ptr).ptr);
    }
  function exception_decRef(info) {
      // A rethrown exception can reach refcount 0; it must not be discarded
      // Its next handler will clear the rethrown flag and addRef it, prior to
      // final decRef and destruction here
      if (info.release_ref() && !info.get_rethrown()) {
        var destructor = info.get_destructor();
        if (destructor) {
          // In Wasm, destructors return 'this' as in ARM
          (function(a1) { return dynCall_ii.apply(null, [destructor, a1]); })(info.excPtr);
        }
        ___cxa_free_exception(info.excPtr);
      }
    }
  function ___cxa_end_catch() {
      // Clear state flag.
      _setThrew(0);
      // Call destructor if one is registered then clear it.
      var catchInfo = exceptionCaught.pop();
  
      exception_decRef(catchInfo.get_exception_info());
      catchInfo.free();
      exceptionLast = 0; // XXX in decRef?
    }

  function ___resumeException(catchInfoPtr) {
      var catchInfo = new CatchInfo(catchInfoPtr);
      var ptr = catchInfo.get_base_ptr();
      if (!exceptionLast) { exceptionLast = ptr; }
      catchInfo.free();
      throw ptr;
    }
  function ___cxa_find_matching_catch_2() {
      var thrown = exceptionLast;
      if (!thrown) {
        // just pass through the null ptr
        setTempRet0(0); return ((0)|0);
      }
      var info = new ExceptionInfo(thrown);
      var thrownType = info.get_type();
      var catchInfo = new CatchInfo();
      catchInfo.set_base_ptr(thrown);
      if (!thrownType) {
        // just pass through the thrown ptr
        setTempRet0(0); return ((catchInfo.ptr)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      // can_catch receives a **, add indirection
      var stackTop = stackSave();
      var exceptionThrowBuf = stackAlloc(4);
      HEAP32[((exceptionThrowBuf)>>2)] = thrown;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        var caughtType = typeArray[i];
        if (caughtType === 0 || caughtType === thrownType) {
          // Catch all clause matched or exactly the same type is caught
          break;
        }
        if (___cxa_can_catch(caughtType, thrownType, exceptionThrowBuf)) {
          var adjusted = HEAP32[((exceptionThrowBuf)>>2)];
          if (thrown !== adjusted) {
            catchInfo.set_adjusted_ptr(adjusted);
          }
          setTempRet0(caughtType); return ((catchInfo.ptr)|0);
        }
      }
      stackRestore(stackTop);
      setTempRet0(thrownType); return ((catchInfo.ptr)|0);
    }

  function ___cxa_find_matching_catch_3() {
      var thrown = exceptionLast;
      if (!thrown) {
        // just pass through the null ptr
        setTempRet0(0); return ((0)|0);
      }
      var info = new ExceptionInfo(thrown);
      var thrownType = info.get_type();
      var catchInfo = new CatchInfo();
      catchInfo.set_base_ptr(thrown);
      if (!thrownType) {
        // just pass through the thrown ptr
        setTempRet0(0); return ((catchInfo.ptr)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      // can_catch receives a **, add indirection
      var stackTop = stackSave();
      var exceptionThrowBuf = stackAlloc(4);
      HEAP32[((exceptionThrowBuf)>>2)] = thrown;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        var caughtType = typeArray[i];
        if (caughtType === 0 || caughtType === thrownType) {
          // Catch all clause matched or exactly the same type is caught
          break;
        }
        if (___cxa_can_catch(caughtType, thrownType, exceptionThrowBuf)) {
          var adjusted = HEAP32[((exceptionThrowBuf)>>2)];
          if (thrown !== adjusted) {
            catchInfo.set_adjusted_ptr(adjusted);
          }
          setTempRet0(caughtType); return ((catchInfo.ptr)|0);
        }
      }
      stackRestore(stackTop);
      setTempRet0(thrownType); return ((catchInfo.ptr)|0);
    }


  function ___cxa_rethrow() {
      var catchInfo = exceptionCaught.pop();
      if (!catchInfo) {
        abort('no exception to throw');
      }
      var info = catchInfo.get_exception_info();
      var ptr = catchInfo.get_base_ptr();
      if (!info.get_rethrown()) {
        // Only pop if the corresponding push was through rethrow_primary_exception
        exceptionCaught.push(catchInfo);
        info.set_rethrown(true);
        info.set_caught(false);
        uncaughtExceptionCount++;
      } else {
        catchInfo.free();
      }
      exceptionLast = ptr;
      throw ptr;
    }

  function ___cxa_throw(ptr, type, destructor) {
      var info = new ExceptionInfo(ptr);
      // Initialize ExceptionInfo content after it was allocated in __cxa_allocate_exception.
      info.init(type, destructor);
      exceptionLast = ptr;
      uncaughtExceptionCount++;
      throw ptr;
    }

  function ___cxa_uncaught_exceptions() {
      return uncaughtExceptionCount;
    }


  var PATH={splitPath:function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function(parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function(path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function(path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function(path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function(path) {
        return PATH.splitPath(path)[3];
      },join:function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function(l, r) {
        return PATH.normalize(l + '/' + r);
      }};
  
  function getRandomDevice() {
      if (typeof crypto === 'object' && typeof crypto['getRandomValues'] === 'function') {
        // for modern web browsers
        var randomBuffer = new Uint8Array(1);
        return function() { crypto.getRandomValues(randomBuffer); return randomBuffer[0]; };
      } else
      if (ENVIRONMENT_IS_NODE) {
        // for nodejs with or without crypto support included
        try {
          var crypto_module = require('crypto');
          // nodejs has crypto support
          return function() { return crypto_module['randomBytes'](1)[0]; };
        } catch (e) {
          // nodejs doesn't have crypto support
        }
      }
      // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
      return function() { abort("randomDevice"); };
    }
  
  var PATH_FS={resolve:function() {
        var resolvedPath = '',
          resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = (i >= 0) ? arguments[i] : FS.cwd();
          // Skip empty and invalid entries
          if (typeof path !== 'string') {
            throw new TypeError('Arguments to path.resolve must be strings');
          } else if (!path) {
            return ''; // an invalid portion invalidates the whole thing
          }
          resolvedPath = path + '/' + resolvedPath;
          resolvedAbsolute = path.charAt(0) === '/';
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter(function(p) {
          return !!p;
        }), !resolvedAbsolute).join('/');
        return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
      },relative:function(from, to) {
        from = PATH_FS.resolve(from).substr(1);
        to = PATH_FS.resolve(to).substr(1);
        function trim(arr) {
          var start = 0;
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
          }
          var end = arr.length - 1;
          for (; end >= 0; end--) {
            if (arr[end] !== '') break;
          }
          if (start > end) return [];
          return arr.slice(start, end - start + 1);
        }
        var fromParts = trim(from.split('/'));
        var toParts = trim(to.split('/'));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
          }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..');
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join('/');
      }};
  
  var TTY={ttys:[],init:function () {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process['stdin']['setEncoding']('utf8');
        // }
      },shutdown:function() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process['stdin']['pause']();
        // }
      },register:function(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },stream_ops:{open:function(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },close:function(stream) {
          // flush any pending line data
          stream.tty.ops.flush(stream.tty);
        },flush:function(stream) {
          stream.tty.ops.flush(stream.tty);
        },read:function(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        },write:function(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        }},default_tty_ops:{get_char:function(tty) {
          if (!tty.input.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              // we will read data by chunks of BUFSIZE
              var BUFSIZE = 256;
              var buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE);
              var bytesRead = 0;
  
              try {
                bytesRead = nodeFS.readSync(process.stdin.fd, buf, 0, BUFSIZE, null);
              } catch(e) {
                // Cross-platform differences: on Windows, reading EOF throws an exception, but on other OSes,
                // reading EOF returns 0. Uniformize behavior by treating the EOF exception to return 0.
                if (e.toString().includes('EOF')) bytesRead = 0;
                else throw e;
              }
  
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString('utf-8');
              } else {
                result = null;
              }
            } else
            if (typeof window != 'undefined' &&
              typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');  // returns null on cancel
              if (result !== null) {
                result += '\n';
              }
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
              if (result !== null) {
                result += '\n';
              }
            }
            if (!result) {
              return null;
            }
            tty.input = intArrayFromString(result, true);
          }
          return tty.input.shift();
        },put_char:function(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },flush:function(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }},default_tty1_ops:{put_char:function(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },flush:function(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }}};
  
  function mmapAlloc(size) {
      var alignedSize = alignMemory(size, 65536);
      var ptr = _malloc(alignedSize);
      while (size < alignedSize) HEAP8[ptr + size++] = 0;
      return ptr;
    }
  var MEMFS={ops_table:null,mount:function(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createNode:function(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63);
        }
        if (!MEMFS.ops_table) {
          MEMFS.ops_table = {
            dir: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                lookup: MEMFS.node_ops.lookup,
                mknod: MEMFS.node_ops.mknod,
                rename: MEMFS.node_ops.rename,
                unlink: MEMFS.node_ops.unlink,
                rmdir: MEMFS.node_ops.rmdir,
                readdir: MEMFS.node_ops.readdir,
                symlink: MEMFS.node_ops.symlink
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek
              }
            },
            file: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: {
                llseek: MEMFS.stream_ops.llseek,
                read: MEMFS.stream_ops.read,
                write: MEMFS.stream_ops.write,
                allocate: MEMFS.stream_ops.allocate,
                mmap: MEMFS.stream_ops.mmap,
                msync: MEMFS.stream_ops.msync
              }
            },
            link: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr,
                readlink: MEMFS.node_ops.readlink
              },
              stream: {}
            },
            chrdev: {
              node: {
                getattr: MEMFS.node_ops.getattr,
                setattr: MEMFS.node_ops.setattr
              },
              stream: FS.chrdev_stream_ops
            }
          };
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          node.usedBytes = 0; // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null; 
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.timestamp = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.timestamp = node.timestamp;
        }
        return node;
      },getFileDataAsTypedArray:function(node) {
        if (!node.contents) return new Uint8Array(0);
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents);
      },expandFileStorage:function(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0); // Copy old data over to the new storage.
      },resizeFileStorage:function(node, newSize) {
        if (node.usedBytes == newSize) return;
        if (newSize == 0) {
          node.contents = null; // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0;
        } else {
          var oldContents = node.contents;
          node.contents = new Uint8Array(newSize); // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
          }
          node.usedBytes = newSize;
        }
      },node_ops:{getattr:function(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },setattr:function(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },lookup:function(parent, name) {
          throw FS.genericErrors[44];
        },mknod:function(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },rename:function(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now()
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        },unlink:function(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },rmdir:function(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        },readdir:function(node) {
          var entries = ['.', '..'];
          for (var key in node.contents) {
            if (!node.contents.hasOwnProperty(key)) {
              continue;
            }
            entries.push(key);
          }
          return entries;
        },symlink:function(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 /* 0777 */ | 40960, 0);
          node.link = oldpath;
          return node;
        },readlink:function(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        }},stream_ops:{read:function(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) { // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        },write:function(stream, buffer, offset, length, position, canOwn) {
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
  
          if (buffer.subarray && (!node.contents || node.contents.subarray)) { // This write is from a typed array to a typed array?
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) { // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
  
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position+length);
          if (node.contents.subarray && buffer.subarray) {
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
             node.contents[position + i] = buffer[offset + i]; // Or fall back to manual write if not.
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        },llseek:function(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },allocate:function(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        },mmap:function(stream, address, length, position, prot, flags) {
          if (address !== 0) {
            // We don't currently support location hints for the address of the mapping
            throw new FS.ErrnoError(28);
          }
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the buffer
            // we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr);
          }
          return { ptr: ptr, allocated: allocated };
        },msync:function(stream, buffer, offset, length, mmapFlags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (mmapFlags & 2) {
            // MAP_PRIVATE calls need not to be synced back to underlying fs
            return 0;
          }
  
          var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        }}};
  var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},filesystems:null,syncFSRequests:0,lookupPath:function(path, opts) {
        path = PATH_FS.resolve(FS.cwd(), path);
        opts = opts || {};
  
        if (!path) return { path: '', node: null };
  
        var defaults = {
          follow_mount: true,
          recurse_count: 0
        };
        for (var key in defaults) {
          if (opts[key] === undefined) {
            opts[key] = defaults[key];
          }
        }
  
        if (opts.recurse_count > 8) {  // max recursive lookup of 8
          throw new FS.ErrnoError(32);
        }
  
        // split the path
        var parts = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), false);
  
        // start at the root
        var current = FS.root;
        var current_path = '/';
  
        for (var i = 0; i < parts.length; i++) {
          var islast = (i === parts.length-1);
          if (islast && opts.parent) {
            // stop resolving
            break;
          }
  
          current = FS.lookupNode(current, parts[i]);
          current_path = PATH.join2(current_path, parts[i]);
  
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root;
            }
          }
  
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0;
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path);
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
  
              var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count });
              current = lookup.node;
  
              if (count++ > 40) {  // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32);
              }
            }
          }
        }
  
        return { path: current_path, node: current };
      },getPath:function(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? mount + '/' + path : mount + path;
          }
          path = path ? node.name + '/' + path : node.name;
          node = node.parent;
        }
      },hashName:function(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },hashAddNode:function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },hashRemoveNode:function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },lookupNode:function(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode, parent);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },createNode:function(parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },destroyNode:function(node) {
        FS.hashRemoveNode(node);
      },isRoot:function(node) {
        return node === node.parent;
      },isMountpoint:function(node) {
        return !!node.mounted;
      },isFile:function(mode) {
        return (mode & 61440) === 32768;
      },isDir:function(mode) {
        return (mode & 61440) === 16384;
      },isLink:function(mode) {
        return (mode & 61440) === 40960;
      },isChrdev:function(mode) {
        return (mode & 61440) === 8192;
      },isBlkdev:function(mode) {
        return (mode & 61440) === 24576;
      },isFIFO:function(mode) {
        return (mode & 61440) === 4096;
      },isSocket:function(mode) {
        return (mode & 49152) === 49152;
      },flagModes:{"r":0,"r+":2,"w":577,"w+":578,"a":1089,"a+":1090},modeStringToFlags:function(str) {
        var flags = FS.flagModes[str];
        if (typeof flags === 'undefined') {
          throw new Error('Unknown file open mode: ' + str);
        }
        return flags;
      },flagsToPermissionString:function(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },nodePermissions:function(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        } else if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        } else if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },mayLookup:function(dir) {
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },mayCreate:function(dir, name) {
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },mayDelete:function(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31;
          }
        }
        return 0;
      },mayOpen:function(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        } else if (FS.isDir(node.mode)) {
          if (FS.flagsToPermissionString(flags) !== 'r' || // opening for write
              (flags & 512)) { // TODO: check for O_SEARCH? (== search for dir only)
            return 31;
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
      },MAX_OPEN_FDS:4096,nextfd:function(fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },getStream:function(fd) {
        return FS.streams[fd];
      },createStream:function(stream, fd_start, fd_end) {
        if (!FS.FSStream) {
          FS.FSStream = /** @constructor */ function(){};
          FS.FSStream.prototype = {
            object: {
              get: function() { return this.node; },
              set: function(val) { this.node = val; }
            },
            isRead: {
              get: function() { return (this.flags & 2097155) !== 1; }
            },
            isWrite: {
              get: function() { return (this.flags & 2097155) !== 0; }
            },
            isAppend: {
              get: function() { return (this.flags & 1024); }
            }
          };
        }
        // clone it, so we can return an instance of FSStream
        var newStream = new FS.FSStream();
        for (var p in stream) {
          newStream[p] = stream[p];
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },closeStream:function(fd) {
        FS.streams[fd] = null;
      },chrdev_stream_ops:{open:function(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
        },llseek:function() {
          throw new FS.ErrnoError(70);
        }},major:function(dev) {
        return ((dev) >> 8);
      },minor:function(dev) {
        return ((dev) & 0xff);
      },makedev:function(ma, mi) {
        return ((ma) << 8 | (mi));
      },registerDevice:function(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },getDevice:function(dev) {
        return FS.devices[dev];
      },getMounts:function(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push.apply(check, m.mounts);
        }
  
        return mounts;
      },syncfs:function(populate, callback) {
        if (typeof(populate) === 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err('warning: ' + FS.syncFSRequests + ' FS.syncfs operations in flight at once, probably just doing extra work');
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        mounts.forEach(function (mount) {
          if (!mount.type.syncfs) {
            return done(null);
          }
          mount.type.syncfs(mount, populate, done);
        });
      },mount:function(type, opts, mountpoint) {
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },unmount:function (mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        Object.keys(FS.nameTable).forEach(function (hash) {
          var current = FS.nameTable[hash];
  
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        });
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1);
      },lookup:function(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },mknod:function(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },create:function(path, mode) {
        mode = mode !== undefined ? mode : 438 /* 0666 */;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },mkdir:function(path, mode) {
        mode = mode !== undefined ? mode : 511 /* 0777 */;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },mkdirTree:function(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue;
          d += '/' + dirs[i];
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },mkdev:function(path, mode, dev) {
        if (typeof(dev) === 'undefined') {
          dev = mode;
          mode = 438 /* 0666 */;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },symlink:function(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },rename:function(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existant directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        try {
          if (FS.trackingDelegate['willMovePath']) {
            FS.trackingDelegate['willMovePath'](old_path, new_path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
        try {
          if (FS.trackingDelegate['onMovePath']) FS.trackingDelegate['onMovePath'](old_path, new_path);
        } catch(e) {
          err("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: " + e.message);
        }
      },rmdir:function(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          err("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readdir:function(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54);
        }
        return node.node_ops.readdir(node);
      },unlink:function(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        try {
          if (FS.trackingDelegate['willDeletePath']) {
            FS.trackingDelegate['willDeletePath'](path);
          }
        } catch(e) {
          err("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: " + e.message);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
          if (FS.trackingDelegate['onDeletePath']) FS.trackingDelegate['onDeletePath'](path);
        } catch(e) {
          err("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: " + e.message);
        }
      },readlink:function(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
      },stat:function(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63);
        }
        return node.node_ops.getattr(node);
      },lstat:function(path) {
        return FS.stat(path, true);
      },chmod:function(path, mode, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now()
        });
      },lchmod:function(path, mode) {
        FS.chmod(path, mode, true);
      },fchmod:function(fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chmod(stream.node, mode);
      },chown:function(path, uid, gid, dontFollow) {
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now()
          // we ignore the uid / gid for now
        });
      },lchown:function(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },fchown:function(fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        FS.chown(stream.node, uid, gid);
      },truncate:function(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path === 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now()
        });
      },ftruncate:function(fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.truncate(stream.node, len);
      },utime:function(path, atime, mtime) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime)
        });
      },open:function(path, flags, mode, fd_start, fd_end) {
        if (path === "") {
          throw new FS.ErrnoError(44);
        }
        flags = typeof flags === 'string' ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === 'undefined' ? 438 /* 0666 */ : mode;
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        if (typeof path === 'object') {
          node = path;
        } else {
          path = PATH.normalize(path);
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072)
            });
            node = lookup.node;
          } catch (e) {
            // ignore
          }
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512)) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        }, fd_start, fd_end);
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {};
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1;
            err("FS.trackingDelegate error on read file: " + path);
          }
        }
        try {
          if (FS.trackingDelegate['onOpenFile']) {
            var trackingFlags = 0;
            if ((flags & 2097155) !== 1) {
              trackingFlags |= FS.tracking.openFlags.READ;
            }
            if ((flags & 2097155) !== 0) {
              trackingFlags |= FS.tracking.openFlags.WRITE;
            }
            FS.trackingDelegate['onOpenFile'](path, trackingFlags);
          }
        } catch(e) {
          err("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: " + e.message);
        }
        return stream;
      },close:function(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },isClosed:function(stream) {
        return stream.fd === null;
      },llseek:function(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },read:function(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },write:function(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position !== 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        try {
          if (stream.path && FS.trackingDelegate['onWriteToFile']) FS.trackingDelegate['onWriteToFile'](stream.path);
        } catch(e) {
          err("FS.trackingDelegate['onWriteToFile']('"+stream.path+"') threw an exception: " + e.message);
        }
        return bytesWritten;
      },allocate:function(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138);
        }
        stream.stream_ops.allocate(stream, offset, length);
      },mmap:function(stream, address, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        return stream.stream_ops.mmap(stream, address, length, position, prot, flags);
      },msync:function(stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },munmap:function(stream) {
        return 0;
      },ioctl:function(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },readFile:function(path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 0;
        opts.encoding = opts.encoding || 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error('Invalid encoding type "' + opts.encoding + '"');
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0);
        } else if (opts.encoding === 'binary') {
          ret = buf;
        }
        FS.close(stream);
        return ret;
      },writeFile:function(path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data)+1);
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        } else {
          throw new Error('Unsupported data type');
        }
        FS.close(stream);
      },cwd:function() {
        return FS.currentPath;
      },chdir:function(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },createDefaultDirectories:function() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },createDefaultDevices:function() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: function() { return 0; },
          write: function(stream, buffer, offset, length, pos) { return length; }
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        var random_device = getRandomDevice();
        FS.createDevice('/dev', 'random', random_device);
        FS.createDevice('/dev', 'urandom', random_device);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },createSpecialDirectories:function() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount: function() {
            var node = FS.createNode(proc_self, 'fd', 16384 | 511 /* 0777 */, 73);
            node.node_ops = {
              lookup: function(parent, name) {
                var fd = +name;
                var stream = FS.getStream(fd);
                if (!stream) throw new FS.ErrnoError(8);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: function() { return stream.path } }
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },createStandardStreams:function() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout']);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr']);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
      },ensureErrnoError:function() {
        if (FS.ErrnoError) return;
        FS.ErrnoError = /** @this{Object} */ function ErrnoError(errno, node) {
          this.node = node;
          this.setErrno = /** @this{Object} */ function(errno) {
            this.errno = errno;
          };
          this.setErrno(errno);
          this.message = 'FS error';
  
        };
        FS.ErrnoError.prototype = new Error();
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        [44].forEach(function(code) {
          FS.genericErrors[code] = new FS.ErrnoError(code);
          FS.genericErrors[code].stack = '<generic error, no stack>';
        });
      },staticInit:function() {
        FS.ensureErrnoError();
  
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },init:function(input, output, error) {
        FS.init.initialized = true;
  
        FS.ensureErrnoError();
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin'];
        Module['stdout'] = output || Module['stdout'];
        Module['stderr'] = error || Module['stderr'];
  
        FS.createStandardStreams();
      },quit:function() {
        FS.init.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        var fflush = Module['_fflush'];
        if (fflush) fflush(0);
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i];
          if (!stream) {
            continue;
          }
          FS.close(stream);
        }
      },getMode:function(canRead, canWrite) {
        var mode = 0;
        if (canRead) mode |= 292 | 73;
        if (canWrite) mode |= 146;
        return mode;
      },findObject:function(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          return null;
        }
      },analyzePath:function(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },createPath:function(parent, path, canRead, canWrite) {
        parent = typeof parent === 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            // ignore EEXIST
          }
          parent = current;
        }
        return current;
      },createFile:function(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode);
      },createDataFile:function(parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          if (typeof data === 'string') {
            var arr = new Array(data.length);
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
            data = arr;
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
        return node;
      },createDevice:function(parent, name, input, output) {
        var path = PATH.join2(typeof parent === 'string' ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major) FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open: function(stream) {
            stream.seekable = false;
          },
          close: function(stream) {
            // flush any pending line data
            if (output && output.buffer && output.buffer.length) {
              output(10);
            }
          },
          read: function(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          },
          write: function(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },forceLoadFile:function(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (read_) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(read_(obj.url), true);
            obj.usedBytes = obj.contents.length;
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
      },createLazyFile:function(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
        /** @constructor */
        function LazyUint8Array() {
          this.lengthKnown = false;
          this.chunks = []; // Loaded chunks. Index is the chunk number
        }
        LazyUint8Array.prototype.get = /** @this{Object} */ function LazyUint8Array_get(idx) {
          if (idx > this.length-1 || idx < 0) {
            return undefined;
          }
          var chunkOffset = idx % this.chunkSize;
          var chunkNum = (idx / this.chunkSize)|0;
          return this.getter(chunkNum)[chunkOffset];
        };
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
          this.getter = getter;
        };
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
          // Find length
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, false);
          xhr.send(null);
          if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
          var datalength = Number(xhr.getResponseHeader("Content-length"));
          var header;
          var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
          var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
  
          var chunkSize = 1024*1024; // Chunk size in bytes
  
          if (!hasByteServing) chunkSize = datalength;
  
          // Function to get a range from the remote URL.
          var doXHR = (function(from, to) {
            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
            if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
  
            // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
  
            // Some hints to the browser that we want binary data.
            if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
            if (xhr.overrideMimeType) {
              xhr.overrideMimeType('text/plain; charset=x-user-defined');
            }
  
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            if (xhr.response !== undefined) {
              return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
            } else {
              return intArrayFromString(xhr.responseText || '', true);
            }
          });
          var lazyArray = this;
          lazyArray.setDataGetter(function(chunkNum) {
            var start = chunkNum * chunkSize;
            var end = (chunkNum+1) * chunkSize - 1; // including this byte
            end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
              lazyArray.chunks[chunkNum] = doXHR(start, end);
            }
            if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
            return lazyArray.chunks[chunkNum];
          });
  
          if (usesGzip || !datalength) {
            // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
            chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
            datalength = this.getter(0).length;
            chunkSize = datalength;
            out("LazyFiles on gzip forces download of the whole file when length is accessed");
          }
  
          this._length = datalength;
          this._chunkSize = chunkSize;
          this.lengthKnown = true;
        };
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          var lazyArray = new LazyUint8Array();
          Object.defineProperties(lazyArray, {
            length: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._length;
              }
            },
            chunkSize: {
              get: /** @this{Object} */ function() {
                if (!this.lengthKnown) {
                  this.cacheLength();
                }
                return this._chunkSize;
              }
            }
          });
  
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: /** @this {FSNode} */ function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
          var fn = node.stream_ops[key];
          stream_ops[key] = function forceLoadLazyFile() {
            FS.forceLoadFile(node);
            return fn.apply(null, arguments);
          };
        });
        // use a custom read function
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
          FS.forceLoadFile(node);
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        };
        node.stream_ops = stream_ops;
        return node;
      },createPreloadedFile:function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init(); // XXX perhaps this method should move onto Browser?
        // TODO we should allow people to just pass in a complete filename instead
        // of parent and name being that we just join them anyways
        var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency('cp ' + fullname); // might have several active requests for the same fullname
        function processData(byteArray) {
          function finish(byteArray) {
            if (preFinish) preFinish();
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
            }
            if (onload) onload();
            removeRunDependency(dep);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency(dep);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency(dep);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },indexedDB:function() {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      },DB_NAME:function() {
        return 'EM_FS_' + window.location.pathname;
      },DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:function(paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
          out('creating db');
          var db = openRequest.result;
          db.createObjectStore(FS.DB_STORE_NAME);
        };
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          var transaction = db.transaction([FS.DB_STORE_NAME], 'readwrite');
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
            putRequest.onsuccess = function putRequest_onsuccess() { ok++; if (ok + fail == total) finish() };
            putRequest.onerror = function putRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      },loadFilesFromDB:function(paths, onload, onerror) {
        onload = onload || function(){};
        onerror = onerror || function(){};
        var indexedDB = FS.indexedDB();
        try {
          var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
        } catch (e) {
          return onerror(e);
        }
        openRequest.onupgradeneeded = onerror; // no database to load from
        openRequest.onsuccess = function openRequest_onsuccess() {
          var db = openRequest.result;
          try {
            var transaction = db.transaction([FS.DB_STORE_NAME], 'readonly');
          } catch(e) {
            onerror(e);
            return;
          }
          var files = transaction.objectStore(FS.DB_STORE_NAME);
          var ok = 0, fail = 0, total = paths.length;
          function finish() {
            if (fail == 0) onload(); else onerror();
          }
          paths.forEach(function(path) {
            var getRequest = files.get(path);
            getRequest.onsuccess = function getRequest_onsuccess() {
              if (FS.analyzePath(path).exists) {
                FS.unlink(path);
              }
              FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
              ok++;
              if (ok + fail == total) finish();
            };
            getRequest.onerror = function getRequest_onerror() { fail++; if (ok + fail == total) finish() };
          });
          transaction.onerror = onerror;
        };
        openRequest.onerror = onerror;
      }};
  var SYSCALLS={mappings:{},DEFAULT_POLLMASK:5,umask:511,calculateAt:function(dirfd, path, allowEmpty) {
        if (path[0] === '/') {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = FS.getStream(dirfd);
          if (!dirstream) throw new FS.ErrnoError(8);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return PATH.join2(dir, path);
      },doStat:function(func, path, buf) {
        try {
          var stat = func(path);
        } catch (e) {
          if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
            // an error occurred while trying to look up the path; we should just report ENOTDIR
            return -54;
          }
          throw e;
        }
        HEAP32[((buf)>>2)] = stat.dev;
        HEAP32[(((buf)+(4))>>2)] = 0;
        HEAP32[(((buf)+(8))>>2)] = stat.ino;
        HEAP32[(((buf)+(12))>>2)] = stat.mode;
        HEAP32[(((buf)+(16))>>2)] = stat.nlink;
        HEAP32[(((buf)+(20))>>2)] = stat.uid;
        HEAP32[(((buf)+(24))>>2)] = stat.gid;
        HEAP32[(((buf)+(28))>>2)] = stat.rdev;
        HEAP32[(((buf)+(32))>>2)] = 0;
        (tempI64 = [stat.size>>>0,(tempDouble=stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(48))>>2)] = 4096;
        HEAP32[(((buf)+(52))>>2)] = stat.blocks;
        HEAP32[(((buf)+(56))>>2)] = (stat.atime.getTime() / 1000)|0;
        HEAP32[(((buf)+(60))>>2)] = 0;
        HEAP32[(((buf)+(64))>>2)] = (stat.mtime.getTime() / 1000)|0;
        HEAP32[(((buf)+(68))>>2)] = 0;
        HEAP32[(((buf)+(72))>>2)] = (stat.ctime.getTime() / 1000)|0;
        HEAP32[(((buf)+(76))>>2)] = 0;
        (tempI64 = [stat.ino>>>0,(tempDouble=stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((buf)+(80))>>2)] = tempI64[0],HEAP32[(((buf)+(84))>>2)] = tempI64[1]);
        return 0;
      },doMsync:function(addr, stream, len, flags, offset) {
        var buffer = HEAPU8.slice(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },doMkdir:function(path, mode) {
        // remove a trailing slash, if one - /a/b/ has basename of '', but
        // we want to create b in the context of this function
        path = PATH.normalize(path);
        if (path[path.length-1] === '/') path = path.substr(0, path.length-1);
        FS.mkdir(path, mode, 0);
        return 0;
      },doMknod:function(path, mode, dev) {
        // we don't want this in the JS API as it uses mknod to create all nodes.
        switch (mode & 61440) {
          case 32768:
          case 8192:
          case 24576:
          case 4096:
          case 49152:
            break;
          default: return -28;
        }
        FS.mknod(path, mode, dev);
        return 0;
      },doReadlink:function(path, buf, bufsize) {
        if (bufsize <= 0) return -28;
        var ret = FS.readlink(path);
  
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf+len];
        stringToUTF8(ret, buf, bufsize+1);
        // readlink is one of the rare functions that write out a C string, but does never append a null to the output buffer(!)
        // stringToUTF8() always appends a null byte, so restore the character under the null byte after the write.
        HEAP8[buf+len] = endChar;
  
        return len;
      },doAccess:function(path, amode) {
        if (amode & ~7) {
          // need a valid mode
          return -28;
        }
        var node;
        var lookup = FS.lookupPath(path, { follow: true });
        node = lookup.node;
        if (!node) {
          return -44;
        }
        var perms = '';
        if (amode & 4) perms += 'r';
        if (amode & 2) perms += 'w';
        if (amode & 1) perms += 'x';
        if (perms /* otherwise, they've just passed F_OK */ && FS.nodePermissions(node, perms)) {
          return -2;
        }
        return 0;
      },doDup:function(path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest) FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
      },doReadv:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.read(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
          if (curr < len) break; // nothing more to read
        }
        return ret;
      },doWritev:function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[(((iov)+(i*8))>>2)];
          var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
          var curr = FS.write(stream, HEAP8,ptr, len, offset);
          if (curr < 0) return -1;
          ret += curr;
        }
        return ret;
      },varargs:undefined,get:function() {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },getStreamFromFD:function(fd) {
        var stream = FS.getStream(fd);
        if (!stream) throw new FS.ErrnoError(8);
        return stream;
      },get64:function(low, high) {
        return low;
      }};
  function ___sys_access(path, amode) {try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doAccess(path, amode);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_chdir(path) {try {
  
      path = SYSCALLS.getStr(path);
      FS.chdir(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_chmod(path, mode) {try {
  
      path = SYSCALLS.getStr(path);
      FS.chmod(path, mode);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  var ERRNO_CODES={EPERM:63,ENOENT:44,ESRCH:71,EINTR:27,EIO:29,ENXIO:60,E2BIG:1,ENOEXEC:45,EBADF:8,ECHILD:12,EAGAIN:6,EWOULDBLOCK:6,ENOMEM:48,EACCES:2,EFAULT:21,ENOTBLK:105,EBUSY:10,EEXIST:20,EXDEV:75,ENODEV:43,ENOTDIR:54,EISDIR:31,EINVAL:28,ENFILE:41,EMFILE:33,ENOTTY:59,ETXTBSY:74,EFBIG:22,ENOSPC:51,ESPIPE:70,EROFS:69,EMLINK:34,EPIPE:64,EDOM:18,ERANGE:68,ENOMSG:49,EIDRM:24,ECHRNG:106,EL2NSYNC:156,EL3HLT:107,EL3RST:108,ELNRNG:109,EUNATCH:110,ENOCSI:111,EL2HLT:112,EDEADLK:16,ENOLCK:46,EBADE:113,EBADR:114,EXFULL:115,ENOANO:104,EBADRQC:103,EBADSLT:102,EDEADLOCK:16,EBFONT:101,ENOSTR:100,ENODATA:116,ETIME:117,ENOSR:118,ENONET:119,ENOPKG:120,EREMOTE:121,ENOLINK:47,EADV:122,ESRMNT:123,ECOMM:124,EPROTO:65,EMULTIHOP:36,EDOTDOT:125,EBADMSG:9,ENOTUNIQ:126,EBADFD:127,EREMCHG:128,ELIBACC:129,ELIBBAD:130,ELIBSCN:131,ELIBMAX:132,ELIBEXEC:133,ENOSYS:52,ENOTEMPTY:55,ENAMETOOLONG:37,ELOOP:32,EOPNOTSUPP:138,EPFNOSUPPORT:139,ECONNRESET:15,ENOBUFS:42,EAFNOSUPPORT:5,EPROTOTYPE:67,ENOTSOCK:57,ENOPROTOOPT:50,ESHUTDOWN:140,ECONNREFUSED:14,EADDRINUSE:3,ECONNABORTED:13,ENETUNREACH:40,ENETDOWN:38,ETIMEDOUT:73,EHOSTDOWN:142,EHOSTUNREACH:23,EINPROGRESS:26,EALREADY:7,EDESTADDRREQ:17,EMSGSIZE:35,EPROTONOSUPPORT:66,ESOCKTNOSUPPORT:137,EADDRNOTAVAIL:4,ENETRESET:39,EISCONN:30,ENOTCONN:53,ETOOMANYREFS:141,EUSERS:136,EDQUOT:19,ESTALE:72,ENOTSUP:138,ENOMEDIUM:148,EILSEQ:25,EOVERFLOW:61,ECANCELED:11,ENOTRECOVERABLE:56,EOWNERDEAD:62,ESTRPIPE:135};
  var SOCKFS={mount:function(mount) {
        // If Module['websocket'] has already been defined (e.g. for configuring
        // the subprotocol/url) use that, if not initialise it to a new object.
        Module['websocket'] = (Module['websocket'] && 
                               ('object' === typeof Module['websocket'])) ? Module['websocket'] : {};
  
        // Add the Event registration mechanism to the exported websocket configuration
        // object so we can register network callbacks from native JavaScript too.
        // For more documentation see system/include/emscripten/emscripten.h
        Module['websocket']._callbacks = {};
        Module['websocket']['on'] = /** @this{Object} */ function(event, callback) {
          if ('function' === typeof callback) {
            this._callbacks[event] = callback;
          }
          return this;
        };
  
        Module['websocket'].emit = /** @this{Object} */ function(event, param) {
          if ('function' === typeof this._callbacks[event]) {
            this._callbacks[event].call(this, param);
          }
        };
  
        // If debug is enabled register simple default logging callbacks for each Event.
  
        return FS.createNode(null, '/', 16384 | 511 /* 0777 */, 0);
      },createSocket:function(family, type, protocol) {
        type &= ~526336; // Some applications may pass it; it makes no sense for a single process.
        var streaming = type == 1;
        if (protocol) {
          assert(streaming == (protocol == 6)); // if SOCK_STREAM, must be tcp
        }
  
        // create our internal socket structure
        var sock = {
          family: family,
          type: type,
          protocol: protocol,
          server: null,
          error: null, // Used in getsockopt for SOL_SOCKET/SO_ERROR test
          peers: {},
          pending: [],
          recv_queue: [],
          sock_ops: SOCKFS.websocket_sock_ops
        };
  
        // create the filesystem node to store the socket structure
        var name = SOCKFS.nextname();
        var node = FS.createNode(SOCKFS.root, name, 49152, 0);
        node.sock = sock;
  
        // and the wrapping stream that enables library functions such
        // as read and write to indirectly interact with the socket
        var stream = FS.createStream({
          path: name,
          node: node,
          flags: 2,
          seekable: false,
          stream_ops: SOCKFS.stream_ops
        });
  
        // map the new stream to the socket structure (sockets have a 1:1
        // relationship with a stream)
        sock.stream = stream;
  
        return sock;
      },getSocket:function(fd) {
        var stream = FS.getStream(fd);
        if (!stream || !FS.isSocket(stream.node.mode)) {
          return null;
        }
        return stream.node.sock;
      },stream_ops:{poll:function(stream) {
          var sock = stream.node.sock;
          return sock.sock_ops.poll(sock);
        },ioctl:function(stream, request, varargs) {
          var sock = stream.node.sock;
          return sock.sock_ops.ioctl(sock, request, varargs);
        },read:function(stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          var msg = sock.sock_ops.recvmsg(sock, length);
          if (!msg) {
            // socket is closed
            return 0;
          }
          buffer.set(msg.buffer, offset);
          return msg.buffer.length;
        },write:function(stream, buffer, offset, length, position /* ignored */) {
          var sock = stream.node.sock;
          return sock.sock_ops.sendmsg(sock, buffer, offset, length);
        },close:function(stream) {
          var sock = stream.node.sock;
          sock.sock_ops.close(sock);
        }},nextname:function() {
        if (!SOCKFS.nextname.current) {
          SOCKFS.nextname.current = 0;
        }
        return 'socket[' + (SOCKFS.nextname.current++) + ']';
      },websocket_sock_ops:{createPeer:function(sock, addr, port) {
          var ws;
  
          if (typeof addr === 'object') {
            ws = addr;
            addr = null;
            port = null;
          }
  
          if (ws) {
            // for sockets that've already connected (e.g. we're the server)
            // we can inspect the _socket property for the address
            if (ws._socket) {
              addr = ws._socket.remoteAddress;
              port = ws._socket.remotePort;
            }
            // if we're just now initializing a connection to the remote,
            // inspect the url property
            else {
              var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
              if (!result) {
                throw new Error('WebSocket URL must be in the format ws(s)://address:port');
              }
              addr = result[1];
              port = parseInt(result[2], 10);
            }
          } else {
            // create the actual websocket object and connect
            try {
              // runtimeConfig gets set to true if WebSocket runtime configuration is available.
              var runtimeConfig = (Module['websocket'] && ('object' === typeof Module['websocket']));
  
              // The default value is 'ws://' the replace is needed because the compiler replaces '//' comments with '#'
              // comments without checking context, so we'd end up with ws:#, the replace swaps the '#' for '//' again.
              var url = 'ws:#'.replace('#', '//');
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['url']) {
                  url = Module['websocket']['url']; // Fetch runtime WebSocket URL config.
                }
              }
  
              if (url === 'ws://' || url === 'wss://') { // Is the supplied URL config just a prefix, if so complete it.
                var parts = addr.split('/');
                url = url + parts[0] + ":" + port + "/" + parts.slice(1).join('/');
              }
  
              // Make the WebSocket subprotocol (Sec-WebSocket-Protocol) default to binary if no configuration is set.
              var subProtocols = 'binary'; // The default value is 'binary'
  
              if (runtimeConfig) {
                if ('string' === typeof Module['websocket']['subprotocol']) {
                  subProtocols = Module['websocket']['subprotocol']; // Fetch runtime WebSocket subprotocol config.
                }
              }
  
              // The default WebSocket options
              var opts = undefined;
  
              if (subProtocols !== 'null') {
                // The regex trims the string (removes spaces at the beginning and end, then splits the string by
                // <any space>,<any space> into an Array. Whitespace removal is important for Websockify and ws.
                subProtocols = subProtocols.replace(/^ +| +$/g,"").split(/ *, */);
  
                // The node ws library API for specifying optional subprotocol is slightly different than the browser's.
                opts = ENVIRONMENT_IS_NODE ? {'protocol': subProtocols.toString()} : subProtocols;
              }
  
              // some webservers (azure) does not support subprotocol header
              if (runtimeConfig && null === Module['websocket']['subprotocol']) {
                subProtocols = 'null';
                opts = undefined;
              }
  
              // If node we use the ws library.
              var WebSocketConstructor;
              if (ENVIRONMENT_IS_NODE) {
                WebSocketConstructor = /** @type{(typeof WebSocket)} */(require('ws'));
              } else
              {
                WebSocketConstructor = WebSocket;
              }
              ws = new WebSocketConstructor(url, opts);
              ws.binaryType = 'arraybuffer';
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH);
            }
          }
  
          var peer = {
            addr: addr,
            port: port,
            socket: ws,
            dgram_send_queue: []
          };
  
          SOCKFS.websocket_sock_ops.addPeer(sock, peer);
          SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
  
          // if this is a bound dgram socket, send the port number first to allow
          // us to override the ephemeral port reported to us by remotePort on the
          // remote end.
          if (sock.type === 2 && typeof sock.sport !== 'undefined') {
            peer.dgram_send_queue.push(new Uint8Array([
                255, 255, 255, 255,
                'p'.charCodeAt(0), 'o'.charCodeAt(0), 'r'.charCodeAt(0), 't'.charCodeAt(0),
                ((sock.sport & 0xff00) >> 8) , (sock.sport & 0xff)
            ]));
          }
  
          return peer;
        },getPeer:function(sock, addr, port) {
          return sock.peers[addr + ':' + port];
        },addPeer:function(sock, peer) {
          sock.peers[peer.addr + ':' + peer.port] = peer;
        },removePeer:function(sock, peer) {
          delete sock.peers[peer.addr + ':' + peer.port];
        },handlePeerEvents:function(sock, peer) {
          var first = true;
  
          var handleOpen = function () {
  
            Module['websocket'].emit('open', sock.stream.fd);
  
            try {
              var queued = peer.dgram_send_queue.shift();
              while (queued) {
                peer.socket.send(queued);
                queued = peer.dgram_send_queue.shift();
              }
            } catch (e) {
              // not much we can do here in the way of proper error handling as we've already
              // lied and said this data was sent. shut it down.
              peer.socket.close();
            }
          };
  
          function handleMessage(data) {
            if (typeof data === 'string') {
              var encoder = new TextEncoder(); // should be utf-8
              data = encoder.encode(data); // make a typed array from the string
            } else {
              assert(data.byteLength !== undefined); // must receive an ArrayBuffer
              if (data.byteLength == 0) {
                // An empty ArrayBuffer will emit a pseudo disconnect event
                // as recv/recvmsg will return zero which indicates that a socket
                // has performed a shutdown although the connection has not been disconnected yet.
                return;
              } else {
                data = new Uint8Array(data); // make a typed array view on the array buffer
              }
            }
  
            // if this is the port message, override the peer's port with it
            var wasfirst = first;
            first = false;
            if (wasfirst &&
                data.length === 10 &&
                data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 &&
                data[4] === 'p'.charCodeAt(0) && data[5] === 'o'.charCodeAt(0) && data[6] === 'r'.charCodeAt(0) && data[7] === 't'.charCodeAt(0)) {
              // update the peer's port and it's key in the peer map
              var newport = ((data[8] << 8) | data[9]);
              SOCKFS.websocket_sock_ops.removePeer(sock, peer);
              peer.port = newport;
              SOCKFS.websocket_sock_ops.addPeer(sock, peer);
              return;
            }
  
            sock.recv_queue.push({ addr: peer.addr, port: peer.port, data: data });
            Module['websocket'].emit('message', sock.stream.fd);
          };
  
          if (ENVIRONMENT_IS_NODE) {
            peer.socket.on('open', handleOpen);
            peer.socket.on('message', function(data, flags) {
              if (!flags.binary) {
                return;
              }
              handleMessage((new Uint8Array(data)).buffer);  // copy from node Buffer -> ArrayBuffer
            });
            peer.socket.on('close', function() {
              Module['websocket'].emit('close', sock.stream.fd);
            });
            peer.socket.on('error', function(error) {
              // Although the ws library may pass errors that may be more descriptive than
              // ECONNREFUSED they are not necessarily the expected error code e.g. 
              // ENOTFOUND on getaddrinfo seems to be node.js specific, so using ECONNREFUSED
              // is still probably the most useful thing to do.
              sock.error = ERRNO_CODES.ECONNREFUSED; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
              // don't throw
            });
          } else {
            peer.socket.onopen = handleOpen;
            peer.socket.onclose = function() {
              Module['websocket'].emit('close', sock.stream.fd);
            };
            peer.socket.onmessage = function peer_socket_onmessage(event) {
              handleMessage(event.data);
            };
            peer.socket.onerror = function(error) {
              // The WebSocket spec only allows a 'simple event' to be thrown on error,
              // so we only really know as much as ECONNREFUSED.
              sock.error = ERRNO_CODES.ECONNREFUSED; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
              Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'ECONNREFUSED: Connection refused']);
            };
          }
        },poll:function(sock) {
          if (sock.type === 1 && sock.server) {
            // listen sockets should only say they're available for reading
            // if there are pending clients.
            return sock.pending.length ? (64 | 1) : 0;
          }
  
          var mask = 0;
          var dest = sock.type === 1 ?  // we only care about the socket state for connection-based sockets
            SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) :
            null;
  
          if (sock.recv_queue.length ||
              !dest ||  // connection-less sockets are always ready to read
              (dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {  // let recv return 0 once closed
            mask |= (64 | 1);
          }
  
          if (!dest ||  // connection-less sockets are always ready to write
              (dest && dest.socket.readyState === dest.socket.OPEN)) {
            mask |= 4;
          }
  
          if ((dest && dest.socket.readyState === dest.socket.CLOSING) ||
              (dest && dest.socket.readyState === dest.socket.CLOSED)) {
            mask |= 16;
          }
  
          return mask;
        },ioctl:function(sock, request, arg) {
          switch (request) {
            case 21531:
              var bytes = 0;
              if (sock.recv_queue.length) {
                bytes = sock.recv_queue[0].data.length;
              }
              HEAP32[((arg)>>2)] = bytes;
              return 0;
            default:
              return ERRNO_CODES.EINVAL;
          }
        },close:function(sock) {
          // if we've spawned a listen server, close it
          if (sock.server) {
            try {
              sock.server.close();
            } catch (e) {
            }
            sock.server = null;
          }
          // close any peer connections
          var peers = Object.keys(sock.peers);
          for (var i = 0; i < peers.length; i++) {
            var peer = sock.peers[peers[i]];
            try {
              peer.socket.close();
            } catch (e) {
            }
            SOCKFS.websocket_sock_ops.removePeer(sock, peer);
          }
          return 0;
        },bind:function(sock, addr, port) {
          if (typeof sock.saddr !== 'undefined' || typeof sock.sport !== 'undefined') {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already bound
          }
          sock.saddr = addr;
          sock.sport = port;
          // in order to emulate dgram sockets, we need to launch a listen server when
          // binding on a connection-less socket
          // note: this is only required on the server side
          if (sock.type === 2) {
            // close the existing server if it exists
            if (sock.server) {
              sock.server.close();
              sock.server = null;
            }
            // swallow error operation not supported error that occurs when binding in the
            // browser where this isn't supported
            try {
              sock.sock_ops.listen(sock, 0);
            } catch (e) {
              if (!(e instanceof FS.ErrnoError)) throw e;
              if (e.errno !== ERRNO_CODES.EOPNOTSUPP) throw e;
            }
          }
        },connect:function(sock, addr, port) {
          if (sock.server) {
            throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
          }
  
          // TODO autobind
          // if (!sock.addr && sock.type == 2) {
          // }
  
          // early out if we're already connected / in the middle of connecting
          if (typeof sock.daddr !== 'undefined' && typeof sock.dport !== 'undefined') {
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
            if (dest) {
              if (dest.socket.readyState === dest.socket.CONNECTING) {
                throw new FS.ErrnoError(ERRNO_CODES.EALREADY);
              } else {
                throw new FS.ErrnoError(ERRNO_CODES.EISCONN);
              }
            }
          }
  
          // add the socket to our peer list and set our
          // destination address / port to match
          var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
          sock.daddr = peer.addr;
          sock.dport = peer.port;
  
          // always "fail" in non-blocking mode
          throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        },listen:function(sock, backlog) {
          if (!ENVIRONMENT_IS_NODE) {
            throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP);
          }
          if (sock.server) {
             throw new FS.ErrnoError(ERRNO_CODES.EINVAL);  // already listening
          }
          var WebSocketServer = require('ws').Server;
          var host = sock.saddr;
          sock.server = new WebSocketServer({
            host: host,
            port: sock.sport
            // TODO support backlog
          });
          Module['websocket'].emit('listen', sock.stream.fd); // Send Event with listen fd.
  
          sock.server.on('connection', function(ws) {
            if (sock.type === 1) {
              var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
  
              // create a peer on the new socket
              var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
              newsock.daddr = peer.addr;
              newsock.dport = peer.port;
  
              // push to queue for accept to pick up
              sock.pending.push(newsock);
              Module['websocket'].emit('connection', newsock.stream.fd);
            } else {
              // create a peer on the listen socket so calling sendto
              // with the listen socket and an address will resolve
              // to the correct client
              SOCKFS.websocket_sock_ops.createPeer(sock, ws);
              Module['websocket'].emit('connection', sock.stream.fd);
            }
          });
          sock.server.on('closed', function() {
            Module['websocket'].emit('close', sock.stream.fd);
            sock.server = null;
          });
          sock.server.on('error', function(error) {
            // Although the ws library may pass errors that may be more descriptive than
            // ECONNREFUSED they are not necessarily the expected error code e.g. 
            // ENOTFOUND on getaddrinfo seems to be node.js specific, so using EHOSTUNREACH
            // is still probably the most useful thing to do. This error shouldn't
            // occur in a well written app as errors should get trapped in the compiled
            // app's own getaddrinfo call.
            sock.error = ERRNO_CODES.EHOSTUNREACH; // Used in getsockopt for SOL_SOCKET/SO_ERROR test.
            Module['websocket'].emit('error', [sock.stream.fd, sock.error, 'EHOSTUNREACH: Host is unreachable']);
            // don't throw
          });
        },accept:function(listensock) {
          if (!listensock.server) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
          var newsock = listensock.pending.shift();
          newsock.stream.flags = listensock.stream.flags;
          return newsock;
        },getname:function(sock, peer) {
          var addr, port;
          if (peer) {
            if (sock.daddr === undefined || sock.dport === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            }
            addr = sock.daddr;
            port = sock.dport;
          } else {
            // TODO saddr and sport will be set for bind()'d UDP sockets, but what
            // should we be returning for TCP sockets that've been connect()'d?
            addr = sock.saddr || 0;
            port = sock.sport || 0;
          }
          return { addr: addr, port: port };
        },sendmsg:function(sock, buffer, offset, length, addr, port) {
          if (sock.type === 2) {
            // connection-less sockets will honor the message address,
            // and otherwise fall back to the bound destination address
            if (addr === undefined || port === undefined) {
              addr = sock.daddr;
              port = sock.dport;
            }
            // if there was no address to fall back to, error out
            if (addr === undefined || port === undefined) {
              throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ);
            }
          } else {
            // connection-based sockets will only use the bound
            addr = sock.daddr;
            port = sock.dport;
          }
  
          // find the peer for the destination address
          var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
  
          // early out if not connected with a connection-based socket
          if (sock.type === 1) {
            if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
            } else if (dest.socket.readyState === dest.socket.CONNECTING) {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
  
          // create a copy of the incoming data to send, as the WebSocket API
          // doesn't work entirely with an ArrayBufferView, it'll just send
          // the entire underlying buffer
          if (ArrayBuffer.isView(buffer)) {
            offset += buffer.byteOffset;
            buffer = buffer.buffer;
          }
  
          var data;
            data = buffer.slice(offset, offset + length);
  
          // if we're emulating a connection-less dgram socket and don't have
          // a cached connection, queue the buffer to send upon connect and
          // lie, saying the data was sent now.
          if (sock.type === 2) {
            if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
              // if we're not connected, open a new connection
              if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
              }
              dest.dgram_send_queue.push(data);
              return length;
            }
          }
  
          try {
            // send the actual data
            dest.socket.send(data);
            return length;
          } catch (e) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
          }
        },recvmsg:function(sock, length) {
          // http://pubs.opengroup.org/onlinepubs/7908799/xns/recvmsg.html
          if (sock.type === 1 && sock.server) {
            // tcp servers should not be recv()'ing on the listen socket
            throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
          }
  
          var queued = sock.recv_queue.shift();
          if (!queued) {
            if (sock.type === 1) {
              var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
  
              if (!dest) {
                // if we have a destination address but are not connected, error out
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN);
              }
              else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                // return null if the socket has closed
                return null;
              }
              else {
                // else, our socket is in a valid state but truly has nothing available
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
              }
            } else {
              throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
          }
  
          // queued.data will be an ArrayBuffer if it's unadulterated, but if it's
          // requeued TCP data it'll be an ArrayBufferView
          var queuedLength = queued.data.byteLength || queued.data.length;
          var queuedOffset = queued.data.byteOffset || 0;
          var queuedBuffer = queued.data.buffer || queued.data;
          var bytesRead = Math.min(length, queuedLength);
          var res = {
            buffer: new Uint8Array(queuedBuffer, queuedOffset, bytesRead),
            addr: queued.addr,
            port: queued.port
          };
  
          // push back any unread data for TCP connections
          if (sock.type === 1 && bytesRead < queuedLength) {
            var bytesRemaining = queuedLength - bytesRead;
            queued.data = new Uint8Array(queuedBuffer, queuedOffset + bytesRead, bytesRemaining);
            sock.recv_queue.unshift(queued);
          }
  
          return res;
        }}};
  function getSocketFromFD(fd) {
      var socket = SOCKFS.getSocket(fd);
      if (!socket) throw new FS.ErrnoError(8);
      return socket;
    }
  
  var Sockets={BUFFER_SIZE:10240,MAX_BUFFER_SIZE:10485760,nextFd:1,fds:{},nextport:1,maxport:65535,peer:null,connections:{},portmap:{},localAddr:4261412874,addrPool:[33554442,50331658,67108874,83886090,100663306,117440522,134217738,150994954,167772170,184549386,201326602,218103818,234881034]};
  
  function inetNtop4(addr) {
      return (addr & 0xff) + '.' + ((addr >> 8) & 0xff) + '.' + ((addr >> 16) & 0xff) + '.' + ((addr >> 24) & 0xff)
    }
  
  function inetNtop6(ints) {
      //  ref:  http://www.ietf.org/rfc/rfc2373.txt - section 2.5.4
      //  Format for IPv4 compatible and mapped  128-bit IPv6 Addresses
      //  128-bits are split into eight 16-bit words
      //  stored in network byte order (big-endian)
      //  |                80 bits               | 16 |      32 bits        |
      //  +-----------------------------------------------------------------+
      //  |               10 bytes               |  2 |      4 bytes        |
      //  +--------------------------------------+--------------------------+
      //  +               5 words                |  1 |      2 words        |
      //  +--------------------------------------+--------------------------+
      //  |0000..............................0000|0000|    IPv4 ADDRESS     | (compatible)
      //  +--------------------------------------+----+---------------------+
      //  |0000..............................0000|FFFF|    IPv4 ADDRESS     | (mapped)
      //  +--------------------------------------+----+---------------------+
      var str = "";
      var word = 0;
      var longest = 0;
      var lastzero = 0;
      var zstart = 0;
      var len = 0;
      var i = 0;
      var parts = [
        ints[0] & 0xffff,
        (ints[0] >> 16),
        ints[1] & 0xffff,
        (ints[1] >> 16),
        ints[2] & 0xffff,
        (ints[2] >> 16),
        ints[3] & 0xffff,
        (ints[3] >> 16)
      ];
  
      // Handle IPv4-compatible, IPv4-mapped, loopback and any/unspecified addresses
  
      var hasipv4 = true;
      var v4part = "";
      // check if the 10 high-order bytes are all zeros (first 5 words)
      for (i = 0; i < 5; i++) {
        if (parts[i] !== 0) { hasipv4 = false; break; }
      }
  
      if (hasipv4) {
        // low-order 32-bits store an IPv4 address (bytes 13 to 16) (last 2 words)
        v4part = inetNtop4(parts[6] | (parts[7] << 16));
        // IPv4-mapped IPv6 address if 16-bit value (bytes 11 and 12) == 0xFFFF (6th word)
        if (parts[5] === -1) {
          str = "::ffff:";
          str += v4part;
          return str;
        }
        // IPv4-compatible IPv6 address if 16-bit value (bytes 11 and 12) == 0x0000 (6th word)
        if (parts[5] === 0) {
          str = "::";
          //special case IPv6 addresses
          if (v4part === "0.0.0.0") v4part = ""; // any/unspecified address
          if (v4part === "0.0.0.1") v4part = "1";// loopback address
          str += v4part;
          return str;
        }
      }
  
      // Handle all other IPv6 addresses
  
      // first run to find the longest contiguous zero words
      for (word = 0; word < 8; word++) {
        if (parts[word] === 0) {
          if (word - lastzero > 1) {
            len = 0;
          }
          lastzero = word;
          len++;
        }
        if (len > longest) {
          longest = len;
          zstart = word - longest + 1;
        }
      }
  
      for (word = 0; word < 8; word++) {
        if (longest > 1) {
          // compress contiguous zeros - to produce "::"
          if (parts[word] === 0 && word >= zstart && word < (zstart + longest) ) {
            if (word === zstart) {
              str += ":";
              if (zstart === 0) str += ":"; //leading zeros case
            }
            continue;
          }
        }
        // converts 16-bit words from big-endian to little-endian before converting to hex string
        str += Number(_ntohs(parts[word] & 0xffff)).toString(16);
        str += word < 7 ? ":" : "";
      }
      return str;
    }
  function readSockaddr(sa, salen) {
      // family / port offsets are common to both sockaddr_in and sockaddr_in6
      var family = HEAP16[((sa)>>1)];
      var port = _ntohs(HEAPU16[(((sa)+(2))>>1)]);
      var addr;
  
      switch (family) {
        case 2:
          if (salen !== 16) {
            return { errno: 28 };
          }
          addr = HEAP32[(((sa)+(4))>>2)];
          addr = inetNtop4(addr);
          break;
        case 10:
          if (salen !== 28) {
            return { errno: 28 };
          }
          addr = [
            HEAP32[(((sa)+(8))>>2)],
            HEAP32[(((sa)+(12))>>2)],
            HEAP32[(((sa)+(16))>>2)],
            HEAP32[(((sa)+(20))>>2)]
          ];
          addr = inetNtop6(addr);
          break;
        default:
          return { errno: 5 };
      }
  
      return { family: family, addr: addr, port: port };
    }
  function getSocketAddress(addrp, addrlen, allowNull) {
      if (allowNull && addrp === 0) return null;
      var info = readSockaddr(addrp, addrlen);
      if (info.errno) throw new FS.ErrnoError(info.errno);
      info.addr = DNS.lookup_addr(info.addr) || info.addr;
      return info;
    }
  function ___sys_connect(fd, addr, addrlen) {try {
  
      var sock = getSocketFromFD(fd);
      var info = getSocketAddress(addr, addrlen);
      sock.sock_ops.connect(sock, info.addr, info.port);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_fadvise64_64(fd, offset, len, advice) {
      return 0; // your advice is important to us (but we can't use it)
    }

  function ___sys_fchmod(fd, mode) {try {
  
      FS.fchmod(fd, mode);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_fcntl64(fd, cmd, varargs) {SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = SYSCALLS.get();
          if (arg < 0) {
            return -28;
          }
          var newStream;
          newStream = FS.open(stream.path, stream.flags, 0, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = SYSCALLS.get();
          stream.flags |= arg;
          return 0;
        }
        case 12:
        /* case 12: Currently in musl F_GETLK64 has same value as F_GETLK, so omitted to avoid duplicate case blocks. If that changes, uncomment this */ {
          
          var arg = SYSCALLS.get();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 13:
        case 14:
        /* case 13: Currently in musl F_SETLK64 has same value as F_SETLK, so omitted to avoid duplicate case blocks. If that changes, uncomment this */
        /* case 14: Currently in musl F_SETLKW64 has same value as F_SETLKW, so omitted to avoid duplicate case blocks. If that changes, uncomment this */
          
          
          return 0; // Pretend that the locking is successful.
        case 16:
        case 8:
          return -28; // These are for sockets. We don't have them fully implemented yet.
        case 9:
          // musl trusts getown return values, due to a bug where they must be, as they overlap with errors. just return -1 here, so fnctl() returns that, and we set errno ourselves.
          setErrNo(28);
          return -1;
        default: {
          return -28;
        }
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_fstat64(fd, buf) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      return SYSCALLS.doStat(FS.stat, stream.path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_fstatfs64(fd, size, buf) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      return ___sys_statfs64(0, size, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_ftruncate64(fd, zero, low, high) {try {
  
      var length = SYSCALLS.get64(low, high);
      FS.ftruncate(fd, length);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_getcwd(buf, size) {try {
  
      if (size === 0) return -28;
      var cwd = FS.cwd();
      var cwdLengthInBytes = lengthBytesUTF8(cwd);
      if (size < cwdLengthInBytes + 1) return -68;
      stringToUTF8(cwd, buf, size);
      return buf;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_getdents64(fd, dirp, count) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd)
      if (!stream.getdents) {
        stream.getdents = FS.readdir(stream.path);
      }
  
      var struct_size = 280;
      var pos = 0;
      var off = FS.llseek(stream, 0, 1);
  
      var idx = Math.floor(off / struct_size);
  
      while (idx < stream.getdents.length && pos + struct_size <= count) {
        var id;
        var type;
        var name = stream.getdents[idx];
        if (name[0] === '.') {
          id = 1;
          type = 4; // DT_DIR
        } else {
          var child = FS.lookupNode(stream.node, name);
          id = child.id;
          type = FS.isChrdev(child.mode) ? 2 :  // DT_CHR, character device.
                 FS.isDir(child.mode) ? 4 :     // DT_DIR, directory.
                 FS.isLink(child.mode) ? 10 :   // DT_LNK, symbolic link.
                 8;                             // DT_REG, regular file.
        }
        (tempI64 = [id>>>0,(tempDouble=id,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((dirp + pos)>>2)] = tempI64[0],HEAP32[(((dirp + pos)+(4))>>2)] = tempI64[1]);
        (tempI64 = [(idx + 1) * struct_size>>>0,(tempDouble=(idx + 1) * struct_size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((dirp + pos)+(8))>>2)] = tempI64[0],HEAP32[(((dirp + pos)+(12))>>2)] = tempI64[1]);
        HEAP16[(((dirp + pos)+(16))>>1)] = 280;
        HEAP8[(((dirp + pos)+(18))>>0)] = type;
        stringToUTF8(name, dirp + pos + 19, 256);
        pos += struct_size;
        idx += 1;
      }
      FS.llseek(stream, idx * struct_size, 0);
      return pos;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_getpid() {
      return 42;
    }

  function ___sys_getrusage(who, usage) {try {
  
      _memset(usage, 0, 136);
      HEAP32[((usage)>>2)] = 1; // fake some values
      HEAP32[(((usage)+(4))>>2)] = 2;
      HEAP32[(((usage)+(8))>>2)] = 3;
      HEAP32[(((usage)+(12))>>2)] = 4;
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_ioctl(fd, op, varargs) {SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509:
        case 21505: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = SYSCALLS.get();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21531: {
          var argp = SYSCALLS.get();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        default: abort('bad ioctl syscall ' + op);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_link(oldpath, newpath) {
      return -34; // no hardlinks for us
    }

  function ___sys_lstat64(path, buf) {try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doStat(FS.lstat, path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_madvise1(addr, length, advice) {
      return 0; // advice is welcome, but ignored
    }

  function ___sys_mkdir(path, mode) {try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doMkdir(path, mode);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function syscallMmap2(addr, len, prot, flags, fd, off) {
      off <<= 12; // undo pgoffset
      var ptr;
      var allocated = false;
  
      // addr argument must be page aligned if MAP_FIXED flag is set.
      if ((flags & 16) !== 0 && (addr % 65536) !== 0) {
        return -28;
      }
  
      // MAP_ANONYMOUS (aka MAP_ANON) isn't actually defined by POSIX spec,
      // but it is widely used way to allocate memory pages on Linux, BSD and Mac.
      // In this case fd argument is ignored.
      if ((flags & 32) !== 0) {
        ptr = _memalign(65536, len);
        if (!ptr) return -48;
        _memset(ptr, 0, len);
        allocated = true;
      } else {
        var info = FS.getStream(fd);
        if (!info) return -8;
        var res = FS.mmap(info, addr, len, off, prot, flags);
        ptr = res.ptr;
        allocated = res.allocated;
      }
      SYSCALLS.mappings[ptr] = { malloc: ptr, len: len, allocated: allocated, fd: fd, prot: prot, flags: flags, offset: off };
      return ptr;
    }
  function ___sys_mmap2(addr, len, prot, flags, fd, off) {try {
  
      return syscallMmap2(addr, len, prot, flags, fd, off);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_msync(addr, len, flags) {try {
  
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      SYSCALLS.doMsync(addr, FS.getStream(info.fd), len, info.flags, 0);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function syscallMunmap(addr, len) {
      if ((addr | 0) === -1 || len === 0) {
        return -28;
      }
      // TODO: support unmmap'ing parts of allocations
      var info = SYSCALLS.mappings[addr];
      if (!info) return 0;
      if (len === info.len) {
        var stream = FS.getStream(info.fd);
        if (stream) {
          if (info.prot & 2) {
            SYSCALLS.doMsync(addr, stream, len, info.flags, info.offset);
          }
          FS.munmap(stream);
        }
        SYSCALLS.mappings[addr] = null;
        if (info.allocated) {
          _free(info.malloc);
        }
      }
      return 0;
    }
  function ___sys_munmap(addr, len) {try {
  
      return syscallMunmap(addr, len);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_open(path, flags, varargs) {SYSCALLS.varargs = varargs;
  try {
  
      var pathname = SYSCALLS.getStr(path);
      var mode = varargs ? SYSCALLS.get() : 0;
      var stream = FS.open(pathname, flags, mode);
      return stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_readlink(path, buf, bufsize) {try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doReadlink(path, buf, bufsize);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function inetPton4(str) {
      var b = str.split('.');
      for (var i = 0; i < 4; i++) {
        var tmp = Number(b[i]);
        if (isNaN(tmp)) return null;
        b[i] = tmp;
      }
      return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    }
  
  /** @suppress {checkTypes} */
  function jstoi_q(str) {
      return parseInt(str);
    }
  function inetPton6(str) {
      var words;
      var w, offset, z, i;
      /* http://home.deds.nl/~aeron/regex/ */
      var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i
      var parts = [];
      if (!valid6regx.test(str)) {
        return null;
      }
      if (str === "::") {
        return [0, 0, 0, 0, 0, 0, 0, 0];
      }
      // Z placeholder to keep track of zeros when splitting the string on ":"
      if (str.startsWith("::")) {
        str = str.replace("::", "Z:"); // leading zeros case
      } else {
        str = str.replace("::", ":Z:");
      }
  
      if (str.indexOf(".") > 0) {
        // parse IPv4 embedded stress
        str = str.replace(new RegExp('[.]', 'g'), ":");
        words = str.split(":");
        words[words.length-4] = jstoi_q(words[words.length-4]) + jstoi_q(words[words.length-3])*256;
        words[words.length-3] = jstoi_q(words[words.length-2]) + jstoi_q(words[words.length-1])*256;
        words = words.slice(0, words.length-2);
      } else {
        words = str.split(":");
      }
  
      offset = 0; z = 0;
      for (w=0; w < words.length; w++) {
        if (typeof words[w] === 'string') {
          if (words[w] === 'Z') {
            // compressed zeros - write appropriate number of zero words
            for (z = 0; z < (8 - words.length+1); z++) {
              parts[w+z] = 0;
            }
            offset = z-1;
          } else {
            // parse hex to field to 16-bit value and write it in network byte-order
            parts[w+offset] = _htons(parseInt(words[w],16));
          }
        } else {
          // parsed IPv4 words
          parts[w+offset] = words[w];
        }
      }
      return [
        (parts[1] << 16) | parts[0],
        (parts[3] << 16) | parts[2],
        (parts[5] << 16) | parts[4],
        (parts[7] << 16) | parts[6]
      ];
    }
  function writeSockaddr(sa, family, addr, port, addrlen) {
      switch (family) {
        case 2:
          addr = inetPton4(addr);
          if (addrlen) {
            HEAP32[((addrlen)>>2)] = 16;
          }
          HEAP16[((sa)>>1)] = family;
          HEAP32[(((sa)+(4))>>2)] = addr;
          HEAP16[(((sa)+(2))>>1)] = _htons(port);
          /* Use makeSetValue instead of memset to avoid adding memset dependency for all users of writeSockaddr. */
          
          (tempI64 = [0>>>0,(tempDouble=0,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((sa)+(8))>>2)] = tempI64[0],HEAP32[(((sa)+(12))>>2)] = tempI64[1]);
          break;
        case 10:
          addr = inetPton6(addr);
          if (addrlen) {
            HEAP32[((addrlen)>>2)] = 28;
          }
          HEAP32[((sa)>>2)] = family;
          HEAP32[(((sa)+(8))>>2)] = addr[0];
          HEAP32[(((sa)+(12))>>2)] = addr[1];
          HEAP32[(((sa)+(16))>>2)] = addr[2];
          HEAP32[(((sa)+(20))>>2)] = addr[3];
          HEAP16[(((sa)+(2))>>1)] = _htons(port);
          HEAP32[(((sa)+(4))>>2)] = 0;
          HEAP32[(((sa)+(24))>>2)] = 0;
          break;
        default:
          return 5;
      }
      return 0;
    }
  
  var DNS={address_map:{id:1,addrs:{},names:{}},lookup_name:function (name) {
        // If the name is already a valid ipv4 / ipv6 address, don't generate a fake one.
        var res = inetPton4(name);
        if (res !== null) {
          return name;
        }
        res = inetPton6(name);
        if (res !== null) {
          return name;
        }
  
        // See if this name is already mapped.
        var addr;
  
        if (DNS.address_map.addrs[name]) {
          addr = DNS.address_map.addrs[name];
        } else {
          var id = DNS.address_map.id++;
          assert(id < 65535, 'exceeded max address mappings of 65535');
  
          addr = '172.29.' + (id & 0xff) + '.' + (id & 0xff00);
  
          DNS.address_map.names[addr] = name;
          DNS.address_map.addrs[name] = addr;
        }
  
        return addr;
      },lookup_addr:function (addr) {
        if (DNS.address_map.names[addr]) {
          return DNS.address_map.names[addr];
        }
  
        return null;
      }};
  function ___sys_recvfrom(fd, buf, len, flags, addr, addrlen) {try {
  
      var sock = getSocketFromFD(fd);
      var msg = sock.sock_ops.recvmsg(sock, len);
      if (!msg) return 0; // socket is closed
      if (addr) {
        var errno = writeSockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port, addrlen);
      }
      HEAPU8.set(msg.buffer, buf);
      return msg.buffer.byteLength;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_rename(old_path, new_path) {try {
  
      old_path = SYSCALLS.getStr(old_path);
      new_path = SYSCALLS.getStr(new_path);
      FS.rename(old_path, new_path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_rmdir(path) {try {
  
      path = SYSCALLS.getStr(path);
      FS.rmdir(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_sendto(fd, message, length, flags, addr, addr_len) {try {
  
      var sock = getSocketFromFD(fd);
      var dest = getSocketAddress(addr, addr_len, true);
      if (!dest) {
        // send, no address provided
        return FS.write(sock.stream, HEAP8,message, length);
      } else {
        // sendto an address
        return sock.sock_ops.sendmsg(sock, HEAP8,message, length, dest.addr, dest.port);
      }
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_setsockopt(fd) {try {
  
      return -50; // The option is unknown at the level indicated.
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_shutdown(fd, how) {try {
  
      getSocketFromFD(fd);
      return -52; // unsupported feature
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_socket(domain, type, protocol) {try {
  
      var sock = SOCKFS.createSocket(domain, type, protocol);
      return sock.stream.fd;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_stat64(path, buf) {try {
  
      path = SYSCALLS.getStr(path);
      return SYSCALLS.doStat(FS.stat, path, buf);
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_symlink(target, linkpath) {try {
  
      target = SYSCALLS.getStr(target);
      linkpath = SYSCALLS.getStr(linkpath);
      FS.symlink(target, linkpath);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_unlink(path) {try {
  
      path = SYSCALLS.getStr(path);
      FS.unlink(path);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___sys_utimensat(dirfd, path, times, flags) {try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path, true);
      var seconds = HEAP32[((times)>>2)];
      var nanoseconds = HEAP32[(((times)+(4))>>2)];
      var atime = (seconds*1000) + (nanoseconds/(1000*1000));
      times += 8;
      seconds = HEAP32[((times)>>2)];
      nanoseconds = HEAP32[(((times)+(4))>>2)];
      var mtime = (seconds*1000) + (nanoseconds/(1000*1000));
      FS.utime(path, atime, mtime);
      return 0;  
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function _abort() {
      abort();
    }

  function _emscripten_get_now_res() { // return resolution of get_now, in nanoseconds
      if (ENVIRONMENT_IS_NODE) {
        return 1; // nanoseconds
      } else
      if (typeof dateNow !== 'undefined') {
        return 1000; // microseconds (1/1000 of a millisecond)
      } else
      // Modern environment where performance.now() is supported:
      return 1000; // microseconds (1/1000 of a millisecond)
    }
  function _clock_getres(clk_id, res) {
      // int clock_getres(clockid_t clk_id, struct timespec *res);
      var nsec;
      if (clk_id === 0) {
        nsec = 1000 * 1000; // educated guess that it's milliseconds
      } else if (clk_id === 1 && _emscripten_get_now_is_monotonic) {
        nsec = _emscripten_get_now_res();
      } else {
        setErrNo(28);
        return -1;
      }
      HEAP32[((res)>>2)] = (nsec/1000000000)|0;
      HEAP32[(((res)+(4))>>2)] = nsec // resolution is nanoseconds
      return 0;
    }


  function _difftime(time1, time0) {
      return time1 - time0;
    }

  var DOTNETENTROPY={batchedQuotaMax:65536,getBatchedRandomValues:function (buffer, bufferLength) {
              // for modern web browsers
              // map the work array to the memory buffer passed with the length
              for (var i = 0; i < bufferLength; i += this.batchedQuotaMax) {
                  var view = new Uint8Array(Module.HEAPU8.buffer, buffer + i, Math.min(bufferLength - i, this.batchedQuotaMax));
                  crypto.getRandomValues(view)
              }
          }};
  function _dotnet_browser_entropy(buffer, bufferLength) {
          // check that we have crypto available
          if (typeof crypto === 'object' && typeof crypto['getRandomValues'] === 'function') {
              DOTNETENTROPY.getBatchedRandomValues(buffer, bufferLength)
              return 0;
          } else {
              // we couldn't find a proper implementation, as Math.random() is not suitable
              // instead of aborting here we will return and let managed code handle the message
              return -1;
          }
      }

  var readAsmConstArgsArray=[];
  function readAsmConstArgs(sigPtr, buf) {
      readAsmConstArgsArray.length = 0;
      var ch;
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      buf >>= 2;
      while (ch = HEAPU8[sigPtr++]) {
        // A double takes two 32-bit slots, and must also be aligned - the backend
        // will emit padding to avoid that.
        var double = ch < 105;
        if (double && (buf & 1)) buf++;
        readAsmConstArgsArray.push(double ? HEAPF64[buf++ >> 1] : HEAP32[buf]);
        ++buf;
      }
      return readAsmConstArgsArray;
    }
  function _emscripten_asm_const_int(code, sigPtr, argbuf) {
      var args = readAsmConstArgs(sigPtr, argbuf);
      return ASM_CONSTS[code].apply(null, args);
    }

  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (!Browser.mainLoop.running) {
        
        Browser.mainLoop.running = true;
      }
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (typeof setImmediate === 'undefined') {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = 'setimmediate';
          var Browser_setImmediate_messageHandler = function(event) {
            // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
            // so check for both cases.
            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true);
          setImmediate = /** @type{function(function(): ?, ...?): number} */(function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            if (ENVIRONMENT_IS_WORKER) {
              if (Module['setImmediates'] === undefined) Module['setImmediates'] = [];
              Module['setImmediates'].push(func);
              postMessage({target: emscriptenMainLoopMessageId}); // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, "*"); // On the main thread, can just send the message to itself.
          })
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  
  function runtimeKeepalivePush() {
      runtimeKeepaliveCounter += 1;
    }
  
  function _exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      exit(status);
    }
  function maybeExit() {
      if (!keepRuntimeAlive()) {
        try {
          _exit(EXITSTATUS);
        } catch (e) {
          if (e instanceof ExitStatus) {
            return;
          }
          throw e;
        }
      }
    }
  function setMainLoop(browserIterationFunc, fps, simulateInfiniteLoop, arg, noSetTiming) {
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = browserIterationFunc;
      Browser.mainLoop.arg = arg;
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
      function checkIsRunning() {
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) {
          
          maybeExit();
          return false;
        }
        return true;
      }
  
      // We create the loop runner here but it is not actually running until
      // _emscripten_set_main_loop_timing is called (which might happen a
      // later time).  This member signifies that the current runner has not
      // yet been started so that we can call runtimeKeepalivePush when it
      // gets it timing set for the first time.
      Browser.mainLoop.running = false;
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
  
          // catches pause/resume main loop from blocker execution
          if (!checkIsRunning()) return;
  
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (!checkIsRunning()) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
        GL.newRenderingFrameStarted();
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
        // catch pauses from the main loop itself
        if (!checkIsRunning()) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'unwind';
      }
    }
  
  function callUserCallback(func, synchronous) {
      if (ABORT) {
        return;
      }
      // For synchronous calls, let any exceptions propagate, and don't let the runtime exit.
      if (synchronous) {
        func();
        return;
      }
      try {
        func();
      } catch (e) {
        if (e instanceof ExitStatus) {
          return;
        } else if (e !== 'unwind') {
          // And actual unexpected user-exectpion occured
          if (e && typeof e === 'object' && e.stack) err('exception thrown: ' + [e, e.stack]);
          throw e;
        }
      }
    }
  
  function runtimeKeepalivePop() {
      runtimeKeepaliveCounter -= 1;
    }
  var Browser={mainLoop:{running:false,scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function() {
          Browser.mainLoop.scheduler = null;
          // Incrementing this signals the previous main loop that it's now become old, and it must return.
          Browser.mainLoop.currentlyRunningMainloop++;
        },resume:function() {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          // do not set timing and call scheduler, we will do it on the next lines
          setMainLoop(func, 0, false, Browser.mainLoop.arg, true);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function() {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function(func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          callUserCallback(func);
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function() {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
        // Canvas event setup
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === Module['canvas'] ||
                                document['mozPointerLockElement'] === Module['canvas'] ||
                                document['webkitPointerLockElement'] === Module['canvas'] ||
                                document['msPointerLockElement'] === Module['canvas'];
        }
        var canvas = Module['canvas'];
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
  
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                Module['canvas'].requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function(canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 2,
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
          // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
          // Browser.createContext() should not even be emitted.
          if (typeof GL !== 'undefined') {
            contextHandle = GL.createContext(canvas, contextAttributes);
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx;
            }
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function(canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = Browser.exitFullscreen;
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
  
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        canvasContainer.requestFullscreen();
      },exitFullscreen:function() {
        // This is workaround for chrome. Trying to exit from fullscreen
        // not in fullscreen state will cause "TypeError: Document not active"
        // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
        if (!Browser.isFullscreen) {
          return false;
        }
  
        var CFS = document['exitFullscreen'] ||
                  document['cancelFullScreen'] ||
                  document['mozCancelFullScreen'] ||
                  document['msExitFullscreen'] ||
                  document['webkitCancelFullScreen'] ||
            (function() {});
        CFS.apply(document, []);
        return true;
      },nextRAF:0,fakeRequestAnimationFrame:function(func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function(func) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(func);
          return;
        }
        var RAF = Browser.fakeRequestAnimationFrame;
        RAF(func);
      },safeRequestAnimationFrame:function(func) {
        
        return Browser.requestAnimationFrame(function() {
          
          callUserCallback(func);
        });
      },safeSetTimeout:function(func, timeout) {
        
        return setTimeout(function() {
          
          callUserCallback(func);
        }, timeout);
      },getMimetype:function(name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function(func) {
        if (!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function(event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function(event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function(event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll':
            // 3 lines make up a step
            delta = event.detail / 3;
            break;
          case 'mousewheel':
            // 120 units make up a step
            delta = event.wheelDelta / 120;
            break;
          case 'wheel':
            delta = event.deltaY
            switch (event.deltaMode) {
              case 0:
                // DOM_DELTA_PIXEL: 100 pixels make up a step
                delta /= 100;
                break;
              case 1:
                // DOM_DELTA_LINE: 3 lines make up a step
                delta /= 3;
                break;
              case 2:
                // DOM_DELTA_PAGE: A page makes up 80 steps
                delta *= 80;
                break;
              default:
                throw 'unrecognized mouse wheel delta mode: ' + event.deltaMode;
            }
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function(event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
  
          // check if SDL is available
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
  
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function(url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
        readAsync(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (dep) addRunDependency(dep);
      },resizeListeners:[],updateResizeListeners:function() {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function(width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)] = flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function() {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)] = flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function() {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};
  function _emscripten_async_wget_data(url, arg, onload, onerror) {
      Browser.asyncLoad(UTF8ToString(url), function(byteArray) {
        var buffer = _malloc(byteArray.length);
        HEAPU8.set(byteArray, buffer);
        (function(a1, a2, a3) {  dynCall_viii.apply(null, [onload, a1, a2, a3]); })(arg, buffer, byteArray.length);
        _free(buffer);
      }, function() {
        if (onerror) (function(a1) {  dynCall_vi.apply(null, [onerror, a1]); })(arg);
      }, true /* no need for run dependency, this is async but will not do any prepare etc. step */ );
    }

  function _emscripten_get_heap_max() {
      // Handle the case of 4GB (which would wrap to 0 in the return value) by
      // returning up to 4GB - one wasm page.
      return 2147483648;
    }

  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.copyWithin(dest, src, src + num);
    }

  function emscripten_realloc_buffer(size) {
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow((size - buffer.byteLength + 65535) >>> 16); // .grow() takes a delta compared to the previous size
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1 /*success*/;
      } catch(e) {
      }
      // implicit 0 return to save code size (caller will cast "undefined" into 0
      // anyhow)
    }
  function _emscripten_resize_heap(requestedSize) {
      var oldSize = HEAPU8.length;
      requestedSize = requestedSize >>> 0;
      // With pthreads, races can happen (another thread might increase the size in between), so return a failure, and let the caller retry.
  
      // Memory resize rules:
      // 1. Always increase heap size to at least the requested size, rounded up to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap geometrically: increase the heap size according to 
      //                                         MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%),
      //                                         At most overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap linearly: increase the heap size by at least MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3. Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4. If we were unable to allocate as much memory, it may be due to over-eager decision to excessively reserve due to (3) above.
      //    Hence if an allocation fails, cut down on the amount of excess growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      // In CAN_ADDRESS_2GB mode, stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate full 4GB Wasm memories, the size will wrap
      // back to 0 bytes in Wasm side for any code that deals with heap sizes, which would require special casing all heap size related code to treat
      // 0 specially.
      var maxHeapSize = 2147483648;
      if (requestedSize > maxHeapSize) {
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager reservation that fails, cut down on the
      // attempted size and reserve a smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
  
          return true;
        }
      }
      return false;
    }

  function _emscripten_thread_sleep(msecs) {
      var start = _emscripten_get_now();
      while (_emscripten_get_now() - start < msecs) {
        // Do nothing.
      }
    }

  function __webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(ctx) {
      // Closure is expected to be allowed to minify the '.dibvbi' property, so not accessing it quoted.
      return !!(ctx.dibvbi = ctx.getExtension('WEBGL_draw_instanced_base_vertex_base_instance'));
    }
  
  function __webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(ctx) {
      // Closure is expected to be allowed to minify the '.mdibvbi' property, so not accessing it quoted.
      return !!(ctx.mdibvbi = ctx.getExtension('WEBGL_multi_draw_instanced_base_vertex_base_instance'));
    }
  
  function __webgl_enable_WEBGL_multi_draw(ctx) {
      // Closure is expected to be allowed to minify the '.multiDrawWebgl' property, so not accessing it quoted.
      return !!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'));
    }
  var GL={counter:1,buffers:[],mappedBuffers:{},programs:[],framebuffers:[],renderbuffers:[],textures:[],shaders:[],vaos:[],contexts:[],offscreenCanvases:{},queries:[],samplers:[],transformFeedbacks:[],syncs:[],byteSizeByTypeRoot:5120,byteSizeByType:[1,1,2,2,4,4,4,2,3,4,8],stringCache:{},stringiCache:{},unpackAlignment:4,recordError:function recordError(errorCode) {
        if (!GL.lastError) {
          GL.lastError = errorCode;
        }
      },getNewId:function(table) {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
          table[i] = null;
        }
        return ret;
      },MAX_TEMP_BUFFER_SIZE:2097152,numTempVertexBuffersPerSize:64,log2ceilLookup:function(i) {
        return 32 - Math.clz32(i === 0 ? 0 : i - 1);
      },generateTempBuffers:function(quads, context) {
        var largestIndex = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE);
        context.tempVertexBufferCounters1 = [];
        context.tempVertexBufferCounters2 = [];
        context.tempVertexBufferCounters1.length = context.tempVertexBufferCounters2.length = largestIndex+1;
        context.tempVertexBuffers1 = [];
        context.tempVertexBuffers2 = [];
        context.tempVertexBuffers1.length = context.tempVertexBuffers2.length = largestIndex+1;
        context.tempIndexBuffers = [];
        context.tempIndexBuffers.length = largestIndex+1;
        for (var i = 0; i <= largestIndex; ++i) {
          context.tempIndexBuffers[i] = null; // Created on-demand
          context.tempVertexBufferCounters1[i] = context.tempVertexBufferCounters2[i] = 0;
          var ringbufferLength = GL.numTempVertexBuffersPerSize;
          context.tempVertexBuffers1[i] = [];
          context.tempVertexBuffers2[i] = [];
          var ringbuffer1 = context.tempVertexBuffers1[i];
          var ringbuffer2 = context.tempVertexBuffers2[i];
          ringbuffer1.length = ringbuffer2.length = ringbufferLength;
          for (var j = 0; j < ringbufferLength; ++j) {
            ringbuffer1[j] = ringbuffer2[j] = null; // Created on-demand
          }
        }
  
        if (quads) {
          // GL_QUAD indexes can be precalculated
          context.tempQuadIndexBuffer = GLctx.createBuffer();
          context.GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, context.tempQuadIndexBuffer);
          var numIndexes = GL.MAX_TEMP_BUFFER_SIZE >> 1;
          var quadIndexes = new Uint16Array(numIndexes);
          var i = 0, v = 0;
          while (1) {
            quadIndexes[i++] = v;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v+1;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v+2;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v+2;
            if (i >= numIndexes) break;
            quadIndexes[i++] = v+3;
            if (i >= numIndexes) break;
            v += 4;
          }
          context.GLctx.bufferData(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, quadIndexes, 0x88E4 /*GL_STATIC_DRAW*/);
          context.GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, null);
        }
      },getTempVertexBuffer:function getTempVertexBuffer(sizeBytes) {
        var idx = GL.log2ceilLookup(sizeBytes);
        var ringbuffer = GL.currentContext.tempVertexBuffers1[idx];
        var nextFreeBufferIndex = GL.currentContext.tempVertexBufferCounters1[idx];
        GL.currentContext.tempVertexBufferCounters1[idx] = (GL.currentContext.tempVertexBufferCounters1[idx]+1) & (GL.numTempVertexBuffersPerSize-1);
        var vbo = ringbuffer[nextFreeBufferIndex];
        if (vbo) {
          return vbo;
        }
        var prevVBO = GLctx.getParameter(0x8894 /*GL_ARRAY_BUFFER_BINDING*/);
        ringbuffer[nextFreeBufferIndex] = GLctx.createBuffer();
        GLctx.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, ringbuffer[nextFreeBufferIndex]);
        GLctx.bufferData(0x8892 /*GL_ARRAY_BUFFER*/, 1 << idx, 0x88E8 /*GL_DYNAMIC_DRAW*/);
        GLctx.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, prevVBO);
        return ringbuffer[nextFreeBufferIndex];
      },getTempIndexBuffer:function getTempIndexBuffer(sizeBytes) {
        var idx = GL.log2ceilLookup(sizeBytes);
        var ibo = GL.currentContext.tempIndexBuffers[idx];
        if (ibo) {
          return ibo;
        }
        var prevIBO = GLctx.getParameter(0x8895 /*ELEMENT_ARRAY_BUFFER_BINDING*/);
        GL.currentContext.tempIndexBuffers[idx] = GLctx.createBuffer();
        GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, GL.currentContext.tempIndexBuffers[idx]);
        GLctx.bufferData(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, 1 << idx, 0x88E8 /*GL_DYNAMIC_DRAW*/);
        GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, prevIBO);
        return GL.currentContext.tempIndexBuffers[idx];
      },newRenderingFrameStarted:function newRenderingFrameStarted() {
        if (!GL.currentContext) {
          return;
        }
        var vb = GL.currentContext.tempVertexBuffers1;
        GL.currentContext.tempVertexBuffers1 = GL.currentContext.tempVertexBuffers2;
        GL.currentContext.tempVertexBuffers2 = vb;
        vb = GL.currentContext.tempVertexBufferCounters1;
        GL.currentContext.tempVertexBufferCounters1 = GL.currentContext.tempVertexBufferCounters2;
        GL.currentContext.tempVertexBufferCounters2 = vb;
        var largestIndex = GL.log2ceilLookup(GL.MAX_TEMP_BUFFER_SIZE);
        for (var i = 0; i <= largestIndex; ++i) {
          GL.currentContext.tempVertexBufferCounters1[i] = 0;
        }
      },getSource:function(shader, count, string, length) {
        var source = '';
        for (var i = 0; i < count; ++i) {
          var len = length ? HEAP32[(((length)+(i*4))>>2)] : -1;
          source += UTF8ToString(HEAP32[(((string)+(i*4))>>2)], len < 0 ? undefined : len);
        }
        return source;
      },calcBufLength:function calcBufLength(size, type, stride, count) {
        if (stride > 0) {
          return count * stride;  // XXXvlad this is not exactly correct I don't think
        }
        var typeSize = GL.byteSizeByType[type - GL.byteSizeByTypeRoot];
        return size * typeSize * count;
      },usedTempBuffers:[],preDrawHandleClientVertexAttribBindings:function preDrawHandleClientVertexAttribBindings(count) {
        GL.resetBufferBinding = false;
  
        // TODO: initial pass to detect ranges we need to upload, might not need an upload per attrib
        for (var i = 0; i < GL.currentContext.maxVertexAttribs; ++i) {
          var cb = GL.currentContext.clientBuffers[i];
          if (!cb.clientside || !cb.enabled) continue;
  
          GL.resetBufferBinding = true;
  
          var size = GL.calcBufLength(cb.size, cb.type, cb.stride, count);
          var buf = GL.getTempVertexBuffer(size);
          GLctx.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, buf);
          GLctx.bufferSubData(0x8892 /*GL_ARRAY_BUFFER*/,
                                   0,
                                   HEAPU8.subarray(cb.ptr, cb.ptr + size));
          cb.vertexAttribPointerAdaptor.call(GLctx, i, cb.size, cb.type, cb.normalized, cb.stride, 0);
        }
      },postDrawHandleClientVertexAttribBindings:function postDrawHandleClientVertexAttribBindings() {
        if (GL.resetBufferBinding) {
          GLctx.bindBuffer(0x8892 /*GL_ARRAY_BUFFER*/, GL.buffers[GLctx.currentArrayBufferBinding]);
        }
      },createContext:function(canvas, webGLContextAttributes) {
  
        // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL context on a canvas,
        // calling .getContext() will always return that context independent of which 'webgl' or 'webgl2'
        // context version was passed. See https://bugs.webkit.org/show_bug.cgi?id=222758 and
        // https://github.com/emscripten-core/emscripten/issues/13295.
        // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari version field in above check.
        if (!canvas.getContextSafariWebGL2Fixed) {
          canvas.getContextSafariWebGL2Fixed = canvas.getContext;
          canvas.getContext = function(ver, attrs) {
            var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs);
            return ((ver == 'webgl') == (gl instanceof WebGLRenderingContext)) ? gl : null;
          }
        }
  
        var ctx = canvas.getContext("webgl2", webGLContextAttributes);
  
        if (!ctx) return 0;
  
        var handle = GL.registerContext(ctx, webGLContextAttributes);
  
        return handle;
      },registerContext:function(ctx, webGLContextAttributes) {
        // without pthreads a context is just an integer ID
        var handle = GL.getNewId(GL.contexts);
  
        var context = {
          handle: handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes.majorVersion,
          GLctx: ctx
        };
  
        // Store the created context object so that we can access the context given a canvas without having to pass the parameters again.
        if (ctx.canvas) ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault === 'undefined' || webGLContextAttributes.enableExtensionsByDefault) {
          GL.initExtensions(context);
        }
  
        context.maxVertexAttribs = context.GLctx.getParameter(0x8869 /*GL_MAX_VERTEX_ATTRIBS*/);
        context.clientBuffers = [];
        for (var i = 0; i < context.maxVertexAttribs; i++) {
          context.clientBuffers[i] = { enabled: false, clientside: false, size: 0, type: 0, normalized: 0, stride: 0, ptr: 0, vertexAttribPointerAdaptor: null };
        }
  
        GL.generateTempBuffers(false, context);
  
        return handle;
      },makeContextCurrent:function(contextHandle) {
  
        GL.currentContext = GL.contexts[contextHandle]; // Active Emscripten GL layer context object.
        Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx; // Active WebGL context object.
        return !(contextHandle && !GLctx);
      },getContext:function(contextHandle) {
        return GL.contexts[contextHandle];
      },deleteContext:function(contextHandle) {
        if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
        if (typeof JSEvents === 'object') JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas); // Release all JS event handlers on the DOM element that the GL context is associated with since the context is now deleted.
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined; // Make sure the canvas object no longer refers to the context object so there are no GC surprises.
        GL.contexts[contextHandle] = null;
      },initExtensions:function(context) {
        // If this function is called without a specific context object, init the extensions of the currently active context.
        if (!context) context = GL.currentContext;
  
        if (context.initExtensionsDone) return;
        context.initExtensionsDone = true;
  
        var GLctx = context.GLctx;
  
        // Detect the presence of a few extensions manually, this GL interop layer itself will need to know if they exist.
  
        // Extensions that are available from WebGL >= 2 (no-op if called on a WebGL 1 context active)
        __webgl_enable_WEBGL_draw_instanced_base_vertex_base_instance(GLctx);
        __webgl_enable_WEBGL_multi_draw_instanced_base_vertex_base_instance(GLctx);
  
        // On WebGL 2, EXT_disjoint_timer_query is replaced with an alternative
        // that's based on core APIs, and exposes only the queryCounterEXT()
        // entrypoint.
        if (context.version >= 2) {
          GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query_webgl2");
        }
  
        // However, Firefox exposes the WebGL 1 version on WebGL 2 as well and
        // thus we look for the WebGL 1 version again if the WebGL 2 version
        // isn't present. https://bugzilla.mozilla.org/show_bug.cgi?id=1328882
        if (context.version < 2 || !GLctx.disjointTimerQueryExt)
        {
          GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
        }
  
        __webgl_enable_WEBGL_multi_draw(GLctx);
  
        // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
        var exts = GLctx.getSupportedExtensions() || [];
        exts.forEach(function(ext) {
          // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders are not enabled by default.
          if (!ext.includes('lose_context') && !ext.includes('debug')) {
            // Call .getExtension() to enable that extension permanently.
            GLctx.getExtension(ext);
          }
        });
      }};
  
  var JSEvents={inEventHandler:0,removeAllEventListeners:function() {
        for (var i = JSEvents.eventHandlers.length-1; i >= 0; --i) {
          JSEvents._removeHandler(i);
        }
        JSEvents.eventHandlers = [];
        JSEvents.deferredCalls = [];
      },registerRemoveEventListeners:function() {
        if (!JSEvents.removeEventListenersRegistered) {
          __ATEXIT__.push(JSEvents.removeAllEventListeners);
          JSEvents.removeEventListenersRegistered = true;
        }
      },deferredCalls:[],deferCall:function(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
          if (arrA.length != arrB.length) return false;
  
          for (var i in arrA) {
            if (arrA[i] != arrB[i]) return false;
          }
          return true;
        }
        // Test if the given call was already queued, and if so, don't add it again.
        for (var i in JSEvents.deferredCalls) {
          var call = JSEvents.deferredCalls[i];
          if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
            return;
          }
        }
        JSEvents.deferredCalls.push({
          targetFunction: targetFunction,
          precedence: precedence,
          argsList: argsList
        });
  
        JSEvents.deferredCalls.sort(function(x,y) { return x.precedence < y.precedence; });
      },removeDeferredCalls:function(targetFunction) {
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
            JSEvents.deferredCalls.splice(i, 1);
            --i;
          }
        }
      },canPerformEventHandlerRequests:function() {
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls;
      },runDeferredCalls:function() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
          return;
        }
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          var call = JSEvents.deferredCalls[i];
          JSEvents.deferredCalls.splice(i, 1);
          --i;
          call.targetFunction.apply(null, call.argsList);
        }
      },eventHandlers:[],removeAllHandlersOnTarget:function(target, eventTypeString) {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
          if (JSEvents.eventHandlers[i].target == target && 
            (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
             JSEvents._removeHandler(i--);
           }
        }
      },_removeHandler:function(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
        JSEvents.eventHandlers.splice(i, 1);
      },registerOrRemoveHandler:function(eventHandler) {
        var jsEventHandler = function jsEventHandler(event) {
          // Increment nesting count for the event handler.
          ++JSEvents.inEventHandler;
          JSEvents.currentEventHandler = eventHandler;
          // Process any old deferred calls the user has placed.
          JSEvents.runDeferredCalls();
          // Process the actual event, calls back to user C code handler.
          eventHandler.handlerFunc(event);
          // Process any new deferred calls that were placed right now from this event handler.
          JSEvents.runDeferredCalls();
          // Out of event handler - restore nesting count.
          --JSEvents.inEventHandler;
        };
        
        if (eventHandler.callbackfunc) {
          eventHandler.eventListenerFunc = jsEventHandler;
          eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
          JSEvents.eventHandlers.push(eventHandler);
          JSEvents.registerRemoveEventListeners();
        } else {
          for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == eventHandler.target
             && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
               JSEvents._removeHandler(i--);
             }
          }
        }
      },getNodeNameForTarget:function(target) {
        if (!target) return '';
        if (target == window) return '#window';
        if (target == screen) return '#screen';
        return (target && target.nodeName) ? target.nodeName : '';
      },fullscreenEnabled:function() {
        return document.fullscreenEnabled
        // Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitFullscreenEnabled.
        // TODO: If Safari at some point ships with unprefixed version, update the version check above.
        || document.webkitFullscreenEnabled
         ;
      }};
  
  var __emscripten_webgl_power_preferences=['default', 'low-power', 'high-performance'];
  
  function maybeCStringToJsString(cString) {
      // "cString > 2" checks if the input is a number, and isn't of the special
      // values we accept here, EMSCRIPTEN_EVENT_TARGET_* (which map to 0, 1, 2).
      // In other words, if cString > 2 then it's a pointer to a valid place in
      // memory, and points to a C string.
      return cString > 2 ? UTF8ToString(cString) : cString;
    }
  
  var specialHTMLTargets=[0, typeof document !== 'undefined' ? document : 0, typeof window !== 'undefined' ? window : 0];
  function findEventTarget(target) {
      target = maybeCStringToJsString(target);
      var domElement = specialHTMLTargets[target] || (typeof document !== 'undefined' ? document.querySelector(target) : undefined);
      return domElement;
    }
  
  function findCanvasEventTarget(target) { return findEventTarget(target); }
  function _emscripten_webgl_do_create_context(target, attributes) {
      var a = attributes >> 2;
      var powerPreference = HEAP32[a + (24>>2)];
      var contextAttributes = {
        'alpha': !!HEAP32[a + (0>>2)],
        'depth': !!HEAP32[a + (4>>2)],
        'stencil': !!HEAP32[a + (8>>2)],
        'antialias': !!HEAP32[a + (12>>2)],
        'premultipliedAlpha': !!HEAP32[a + (16>>2)],
        'preserveDrawingBuffer': !!HEAP32[a + (20>>2)],
        'powerPreference': __emscripten_webgl_power_preferences[powerPreference],
        'failIfMajorPerformanceCaveat': !!HEAP32[a + (28>>2)],
        // The following are not predefined WebGL context attributes in the WebGL specification, so the property names can be minified by Closure.
        majorVersion: HEAP32[a + (32>>2)],
        minorVersion: HEAP32[a + (36>>2)],
        enableExtensionsByDefault: HEAP32[a + (40>>2)],
        explicitSwapControl: HEAP32[a + (44>>2)],
        proxyContextToMainThread: HEAP32[a + (48>>2)],
        renderViaOffscreenBackBuffer: HEAP32[a + (52>>2)]
      };
  
      var canvas = findCanvasEventTarget(target);
  
      if (!canvas) {
        return 0;
      }
  
      if (contextAttributes.explicitSwapControl) {
        return 0;
      }
  
      var contextHandle = GL.createContext(canvas, contextAttributes);
      return contextHandle;
    }
  function _emscripten_webgl_create_context(a0,a1
  ) {
  return _emscripten_webgl_do_create_context(a0,a1);
  }

  function _emscripten_webgl_init_context_attributes(attributes) {
      var a = attributes >> 2;
      for (var i = 0; i < (56>>2); ++i) {
        HEAP32[a+i] = 0;
      }
  
      HEAP32[a + (0>>2)] =
      HEAP32[a + (4>>2)] = 
      HEAP32[a + (12>>2)] = 
      HEAP32[a + (16>>2)] = 
      HEAP32[a + (32>>2)] = 
      HEAP32[a + (40>>2)] = 1;
  
    }

  function _emscripten_webgl_make_context_current(contextHandle) {
      var success = GL.makeContextCurrent(contextHandle);
      return success ? 0 : -5;
    }

  function _emscripten_wget_data(url, pbuffer, pnum, perror) {
      Asyncify.handleSleep(function(wakeUp) {
        Browser.asyncLoad(UTF8ToString(url), function(byteArray) {
          // can only allocate the buffer after the wakeUp, not during an asyncing
          var buffer = _malloc(byteArray.length); // must be freed by caller!
          HEAPU8.set(byteArray, buffer);
          HEAP32[((pbuffer)>>2)] = buffer;
          HEAP32[((pnum)>>2)] = byteArray.length;
          HEAP32[((perror)>>2)] = 0;
          wakeUp();
        }, function() {
          HEAP32[((perror)>>2)] = 1;
          wakeUp();
        }, true /* no need for run dependency, this is async but will not do any prepare etc. step */ );
      });
    }

  var ENV={};
  
  function getExecutableName() {
      return thisProgram || './this.program';
    }
  function getEnvStrings() {
      if (!getEnvStrings.strings) {
        // Default values.
        // Browser language detection #8751
        var lang = ((typeof navigator === 'object' && navigator.languages && navigator.languages[0]) || 'C').replace('-', '_') + '.UTF-8';
        var env = {
          'USER': 'web_user',
          'LOGNAME': 'web_user',
          'PATH': '/',
          'PWD': '/',
          'HOME': '/home/web_user',
          'LANG': lang,
          '_': getExecutableName()
        };
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          env[x] = ENV[x];
        }
        var strings = [];
        for (var x in env) {
          strings.push(x + '=' + env[x]);
        }
        getEnvStrings.strings = strings;
      }
      return getEnvStrings.strings;
    }
  function _environ_get(__environ, environ_buf) {try {
  
      var bufSize = 0;
      getEnvStrings().forEach(function(string, i) {
        var ptr = environ_buf + bufSize;
        HEAP32[(((__environ)+(i * 4))>>2)] = ptr;
        writeAsciiToMemory(string, ptr);
        bufSize += string.length + 1;
      });
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _environ_sizes_get(penviron_count, penviron_buf_size) {try {
  
      var strings = getEnvStrings();
      HEAP32[((penviron_count)>>2)] = strings.length;
      var bufSize = 0;
      strings.forEach(function(string) {
        bufSize += string.length + 1;
      });
      HEAP32[((penviron_buf_size)>>2)] = bufSize;
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }


  function _fd_close(fd) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_fdstat_get(fd, pbuf) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      // All character devices are terminals (other things a Linux system would
      // assume is a character device, like the mouse, we have special APIs for).
      var type = stream.tty ? 2 :
                 FS.isDir(stream.mode) ? 3 :
                 FS.isLink(stream.mode) ? 7 :
                 4;
      HEAP8[((pbuf)>>0)] = type;
      // TODO HEAP16[(((pbuf)+(2))>>1)] = ?;
      // TODO (tempI64 = [?>>>0,(tempDouble=?,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((pbuf)+(8))>>2)] = tempI64[0],HEAP32[(((pbuf)+(12))>>2)] = tempI64[1]);
      // TODO (tempI64 = [?>>>0,(tempDouble=?,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[(((pbuf)+(16))>>2)] = tempI64[0],HEAP32[(((pbuf)+(20))>>2)] = tempI64[1]);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_pread(fd, iov, iovcnt, offset_bigint, pnum) {try {
  
      var offset_low = Number(offset_bigint & BigInt(0xffffffff)) | 0, offset_high = Number(offset_bigint >> BigInt(32)) | 0;
      var stream = SYSCALLS.getStreamFromFD(fd)
      var num = SYSCALLS.doReadv(stream, iov, iovcnt, offset_low);
      HEAP32[((pnum)>>2)] = num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_pwrite(fd, iov, iovcnt, offset_bigint, pnum) {try {
  
      var offset_low = Number(offset_bigint & BigInt(0xffffffff)) | 0, offset_high = Number(offset_bigint >> BigInt(32)) | 0;
      var stream = SYSCALLS.getStreamFromFD(fd)
      var num = SYSCALLS.doWritev(stream, iov, iovcnt, offset_low);
      HEAP32[((pnum)>>2)] = num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_read(fd, iov, iovcnt, pnum) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = SYSCALLS.doReadv(stream, iov, iovcnt);
      HEAP32[((pnum)>>2)] = num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_seek(fd, offset_bigint, whence, newOffset) {try {
  
      var offset_low = Number(offset_bigint & BigInt(0xffffffff)) | 0, offset_high = Number(offset_bigint >> BigInt(32)) | 0;
      var stream = SYSCALLS.getStreamFromFD(fd);
      var HIGH_OFFSET = 0x100000000; // 2^32
      // use an unsigned operator on low and shift high by 32-bits
      var offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
  
      var DOUBLE_LIMIT = 0x20000000000000; // 2^53
      // we also check for equality since DOUBLE_LIMIT + 1 == DOUBLE_LIMIT
      if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
        return -61;
      }
  
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble=stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math.min((+(Math.floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_sync(fd) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      return Asyncify.handleSleep(function(wakeUp) {
        var mount = stream.node.mount;
        if (!mount.type.syncfs) {
          // We write directly to the file system, so there's nothing to do here.
          wakeUp(0);
          return;
        }
        mount.type.syncfs(mount, false, function(err) {
          if (err) {
            wakeUp(function() { return 29 });
            return;
          }
          wakeUp(0);
        });
      });
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _fd_write(fd, iov, iovcnt, pnum) {try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = SYSCALLS.doWritev(stream, iov, iovcnt);
      HEAP32[((pnum)>>2)] = num
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
  }

  function _flock(fd, operation) {
      // int flock(int fd, int operation);
      // Pretend to succeed
      return 0;
    }

  var GAI_ERRNO_MESSAGES={};
  function _gai_strerror(val) {
      var buflen = 256;
  
      // On first call to gai_strerror we initialise the buffer and populate the error messages.
      if (!_gai_strerror.buffer) {
          _gai_strerror.buffer = _malloc(buflen);
  
          GAI_ERRNO_MESSAGES['0'] = 'Success';
          GAI_ERRNO_MESSAGES['' + -1] = 'Invalid value for \'ai_flags\' field';
          GAI_ERRNO_MESSAGES['' + -2] = 'NAME or SERVICE is unknown';
          GAI_ERRNO_MESSAGES['' + -3] = 'Temporary failure in name resolution';
          GAI_ERRNO_MESSAGES['' + -4] = 'Non-recoverable failure in name res';
          GAI_ERRNO_MESSAGES['' + -6] = '\'ai_family\' not supported';
          GAI_ERRNO_MESSAGES['' + -7] = '\'ai_socktype\' not supported';
          GAI_ERRNO_MESSAGES['' + -8] = 'SERVICE not supported for \'ai_socktype\'';
          GAI_ERRNO_MESSAGES['' + -10] = 'Memory allocation failure';
          GAI_ERRNO_MESSAGES['' + -11] = 'System error returned in \'errno\'';
          GAI_ERRNO_MESSAGES['' + -12] = 'Argument buffer overflow';
      }
  
      var msg = 'Unknown error';
  
      if (val in GAI_ERRNO_MESSAGES) {
        if (GAI_ERRNO_MESSAGES[val].length > buflen - 1) {
          msg = 'Message too long'; // EMSGSIZE message. This should never occur given the GAI_ERRNO_MESSAGES above.
        } else {
          msg = GAI_ERRNO_MESSAGES[val];
        }
      }
  
      writeAsciiToMemory(msg, _gai_strerror.buffer);
      return _gai_strerror.buffer;
    }

  function _getTempRet0() {
      return getTempRet0();
    }

  function _gettimeofday(ptr) {
      var now = Date.now();
      HEAP32[((ptr)>>2)] = (now/1000)|0; // seconds
      HEAP32[(((ptr)+(4))>>2)] = ((now % 1000)*1000)|0; // microseconds
      return 0;
    }

  function _glActiveTexture(x0) { GLctx['activeTexture'](x0) }

  function _glAttachShader(program, shader) {
      GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
    }

  function _glBindBuffer(target, buffer) {
      if (target == 0x8892 /*GL_ARRAY_BUFFER*/) {
        GLctx.currentArrayBufferBinding = buffer;
      } else if (target == 0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/) {
        GLctx.currentElementArrayBufferBinding = buffer;
      }
  
      if (target == 0x88EB /*GL_PIXEL_PACK_BUFFER*/) {
        // In WebGL 2 glReadPixels entry point, we need to use a different WebGL 2 API function call when a buffer is bound to
        // GL_PIXEL_PACK_BUFFER_BINDING point, so must keep track whether that binding point is non-null to know what is
        // the proper API function to call.
        GLctx.currentPixelPackBufferBinding = buffer;
      } else if (target == 0x88EC /*GL_PIXEL_UNPACK_BUFFER*/) {
        // In WebGL 2 gl(Compressed)Tex(Sub)Image[23]D entry points, we need to
        // use a different WebGL 2 API function call when a buffer is bound to
        // GL_PIXEL_UNPACK_BUFFER_BINDING point, so must keep track whether that
        // binding point is non-null to know what is the proper API function to
        // call.
        GLctx.currentPixelUnpackBufferBinding = buffer;
      }
      GLctx.bindBuffer(target, GL.buffers[buffer]);
    }

  function _glBindFramebuffer(target, framebuffer) {
  
      GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer]);
  
    }

  function _glBindTexture(target, texture) {
      GLctx.bindTexture(target, GL.textures[texture]);
    }

  function _glBindVertexArray(vao) {
      GLctx['bindVertexArray'](GL.vaos[vao]);
      var ibo = GLctx.getParameter(0x8895 /*ELEMENT_ARRAY_BUFFER_BINDING*/);
      GLctx.currentElementArrayBufferBinding = ibo ? (ibo.name | 0) : 0;
    }

  function _glBlitFramebuffer(x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) { GLctx['blitFramebuffer'](x0, x1, x2, x3, x4, x5, x6, x7, x8, x9) }

  function _glBufferData(target, size, data, usage) {
  
      if (true) { // WebGL 2 provides new garbage-free entry points to call to WebGL. Use those always when possible.
        if (data) {
          GLctx.bufferData(target, HEAPU8, usage, data, size);
        } else {
          GLctx.bufferData(target, size, usage);
        }
      } else {
        // N.b. here first form specifies a heap subarray, second form an integer size, so the ?: code here is polymorphic. It is advised to avoid
        // randomly mixing both uses in calling code, to avoid any potential JS engine JIT issues.
        GLctx.bufferData(target, data ? HEAPU8.subarray(data, data+size) : size, usage);
      }
    }

  function _glClear(x0) { GLctx['clear'](x0) }

  function _glClearColor(x0, x1, x2, x3) { GLctx['clearColor'](x0, x1, x2, x3) }

  function _glCompileShader(shader) {
      GLctx.compileShader(GL.shaders[shader]);
    }

  function _glCreateProgram() {
      var id = GL.getNewId(GL.programs);
      var program = GLctx.createProgram();
      // Store additional information needed for each shader program:
      program.name = id;
      // Lazy cache results of glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
      program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0;
      program.uniformIdCounter = 1;
      GL.programs[id] = program;
      return id;
    }

  function _glCreateShader(shaderType) {
      var id = GL.getNewId(GL.shaders);
      GL.shaders[id] = GLctx.createShader(shaderType);
  
      return id;
    }

  function _glDeleteShader(id) {
      if (!id) return;
      var shader = GL.shaders[id];
      if (!shader) { // glDeleteShader actually signals an error when deleting a nonexisting object, unlike some other GL delete functions.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      GLctx.deleteShader(shader);
      GL.shaders[id] = null;
    }

  function _glDrawElements(mode, count, type, indices) {
      var buf;
      if (!GLctx.currentElementArrayBufferBinding) {
        var size = GL.calcBufLength(1, type, 0, count);
        buf = GL.getTempIndexBuffer(size);
        GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, buf);
        GLctx.bufferSubData(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/,
                                 0,
                                 HEAPU8.subarray(indices, indices + size));
        // the index is now 0
        indices = 0;
      }
  
      // bind any client-side buffers
      GL.preDrawHandleClientVertexAttribBindings(count);
  
      GLctx.drawElements(mode, count, type, indices);
  
      GL.postDrawHandleClientVertexAttribBindings(count);
  
      if (!GLctx.currentElementArrayBufferBinding) {
        GLctx.bindBuffer(0x8893 /*GL_ELEMENT_ARRAY_BUFFER*/, null);
      }
    }

  function _glEnableVertexAttribArray(index) {
      var cb = GL.currentContext.clientBuffers[index];
      cb.enabled = true;
      GLctx.enableVertexAttribArray(index);
    }

  function _glFinish() { GLctx['finish']() }

  function _glFramebufferTexture2D(target, attachment, textarget, texture, level) {
      GLctx.framebufferTexture2D(target, attachment, textarget,
                                      GL.textures[texture], level);
    }

  function __glGenObject(n, buffers, createFunction, objectTable
      ) {
      for (var i = 0; i < n; i++) {
        var buffer = GLctx[createFunction]();
        var id = buffer && GL.getNewId(objectTable);
        if (buffer) {
          buffer.name = id;
          objectTable[id] = buffer;
        } else {
          GL.recordError(0x502 /* GL_INVALID_OPERATION */);
        }
        HEAP32[(((buffers)+(i*4))>>2)] = id;
      }
    }
  function _glGenBuffers(n, buffers) {
      __glGenObject(n, buffers, 'createBuffer', GL.buffers
        );
    }

  function _glGenFramebuffers(n, ids) {
      __glGenObject(n, ids, 'createFramebuffer', GL.framebuffers
        );
    }

  function _glGenTextures(n, textures) {
      __glGenObject(n, textures, 'createTexture', GL.textures
        );
    }

  function _glGenVertexArrays(n, arrays) {
      __glGenObject(n, arrays, 'createVertexArray', GL.vaos
        );
    }

  function _glGetProgramInfoLog(program, maxLength, length, infoLog) {
      var log = GLctx.getProgramInfoLog(GL.programs[program]);
      if (log === null) log = '(unknown error)';
      var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[((length)>>2)] = numBytesWrittenExclNull;
    }

  function _glGetProgramiv(program, pname, p) {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
        // if p == null, issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
  
      if (program >= GL.counter) {
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
  
      program = GL.programs[program];
  
      if (pname == 0x8B84) { // GL_INFO_LOG_LENGTH
        var log = GLctx.getProgramInfoLog(program);
        if (log === null) log = '(unknown error)';
        HEAP32[((p)>>2)] = log.length + 1;
      } else if (pname == 0x8B87 /* GL_ACTIVE_UNIFORM_MAX_LENGTH */) {
        if (!program.maxUniformLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8B86/*GL_ACTIVE_UNIFORMS*/); ++i) {
            program.maxUniformLength = Math.max(program.maxUniformLength, GLctx.getActiveUniform(program, i).name.length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxUniformLength;
      } else if (pname == 0x8B8A /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */) {
        if (!program.maxAttributeLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8B89/*GL_ACTIVE_ATTRIBUTES*/); ++i) {
            program.maxAttributeLength = Math.max(program.maxAttributeLength, GLctx.getActiveAttrib(program, i).name.length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxAttributeLength;
      } else if (pname == 0x8A35 /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */) {
        if (!program.maxUniformBlockNameLength) {
          for (var i = 0; i < GLctx.getProgramParameter(program, 0x8A36/*GL_ACTIVE_UNIFORM_BLOCKS*/); ++i) {
            program.maxUniformBlockNameLength = Math.max(program.maxUniformBlockNameLength, GLctx.getActiveUniformBlockName(program, i).length+1);
          }
        }
        HEAP32[((p)>>2)] = program.maxUniformBlockNameLength;
      } else {
        HEAP32[((p)>>2)] = GLctx.getProgramParameter(program, pname);
      }
    }

  function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
      var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
      if (log === null) log = '(unknown error)';
      var numBytesWrittenExclNull = (maxLength > 0 && infoLog) ? stringToUTF8(log, infoLog, maxLength) : 0;
      if (length) HEAP32[((length)>>2)] = numBytesWrittenExclNull;
    }

  function _glGetShaderiv(shader, pname, p) {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null pointer. Since calling this function does not make sense
        // if p == null, issue a GL error to notify user about it.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
        return;
      }
      if (pname == 0x8B84) { // GL_INFO_LOG_LENGTH
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null) log = '(unknown error)';
        // The GLES2 specification says that if the shader has an empty info log,
        // a value of 0 is returned. Otherwise the log has a null char appended.
        // (An empty string is falsey, so we can just check that instead of
        // looking at log.length.)
        var logLength = log ? log.length + 1 : 0;
        HEAP32[((p)>>2)] = logLength;
      } else if (pname == 0x8B88) { // GL_SHADER_SOURCE_LENGTH
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        // source may be a null, or the empty string, both of which are falsey
        // values that we report a 0 length for.
        var sourceLength = source ? source.length + 1 : 0;
        HEAP32[((p)>>2)] = sourceLength;
      } else {
        HEAP32[((p)>>2)] = GLctx.getShaderParameter(GL.shaders[shader], pname);
      }
    }

  /** @noinline */
  function webglGetLeftBracePos(name) {
      return name.slice(-1) == ']' && name.lastIndexOf('[');
    }
  function webglPrepareUniformLocationsBeforeFirstUse(program) {
      var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
        uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
        i, j;
  
      // On the first time invocation of glGetUniformLocation on this shader program:
      // initialize cache data structures and discover which uniforms are arrays.
      if (!uniformLocsById) {
        // maps GLint integer locations to WebGLUniformLocations
        program.uniformLocsById = uniformLocsById = {};
        // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
        program.uniformArrayNamesById = {};
  
        for (i = 0; i < GLctx.getProgramParameter(program, 0x8B86/*GL_ACTIVE_UNIFORMS*/); ++i) {
          var u = GLctx.getActiveUniform(program, i);
          var nm = u.name;
          var sz = u.size;
          var lb = webglGetLeftBracePos(nm);
          var arrayName = lb > 0 ? nm.slice(0, lb) : nm;
  
          // Assign a new location.
          var id = program.uniformIdCounter;
          program.uniformIdCounter += sz;
          // Eagerly get the location of the uniformArray[0] base element.
          // The remaining indices >0 will be left for lazy evaluation to
          // improve performance. Those may never be needed to fetch, if the
          // application fills arrays always in full starting from the first
          // element of the array.
          uniformSizeAndIdsByName[arrayName] = [sz, id];
  
          // Store placeholder integers in place that highlight that these
          // >0 index locations are array indices pending population.
          for(j = 0; j < sz; ++j) {
            uniformLocsById[id] = j;
            program.uniformArrayNamesById[id++] = arrayName;
          }
        }
      }
    }
  function _glGetUniformLocation(program, name) {
  
      name = UTF8ToString(name);
  
      if (program = GL.programs[program]) {
        webglPrepareUniformLocationsBeforeFirstUse(program);
        var uniformLocsById = program.uniformLocsById; // Maps GLuint -> WebGLUniformLocation
        var arrayIndex = 0;
        var uniformBaseName = name;
  
        // Invariant: when populating integer IDs for uniform locations, we must maintain the precondition that
        // arrays reside in contiguous addresses, i.e. for a 'vec4 colors[10];', colors[4] must be at location colors[0]+4.
        // However, user might call glGetUniformLocation(program, "colors") for an array, so we cannot discover based on the user
        // input arguments whether the uniform we are dealing with is an array. The only way to discover which uniforms are arrays
        // is to enumerate over all the active uniforms in the program.
        var leftBrace = webglGetLeftBracePos(name);
  
        // If user passed an array accessor "[index]", parse the array index off the accessor.
        if (leftBrace > 0) {
          arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0; // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
          uniformBaseName = name.slice(0, leftBrace);
        }
  
        // Have we cached the location of this uniform before?
        var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName]; // A pair [array length, GLint of the uniform location]
  
        // If an uniform with this name exists, and if its index is within the array limits (if it's even an array),
        // query the WebGLlocation, or return an existing cached location.
        if (sizeAndId && arrayIndex < sizeAndId[0]) {
          arrayIndex += sizeAndId[1]; // Add the base location of the uniform to the array index offset.
          if ((uniformLocsById[arrayIndex] = uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))) {
            return arrayIndex;
          }
        }
      }
      else {
        // N.b. we are currently unable to distinguish between GL program IDs that never existed vs GL program IDs that have been deleted,
        // so report GL_INVALID_VALUE in both cases.
        GL.recordError(0x501 /* GL_INVALID_VALUE */);
      }
      return -1;
    }

  function _glIsProgram(program) {
      program = GL.programs[program];
      if (!program) return 0;
      return GLctx.isProgram(program);
    }

  function _glIsShader(shader) {
      var s = GL.shaders[shader];
      if (!s) return 0;
      return GLctx.isShader(s);
    }

  function _glLinkProgram(program) {
      program = GL.programs[program];
      GLctx.linkProgram(program);
      // Invalidate earlier computed uniform->ID mappings, those have now become stale
      program.uniformLocsById = 0; // Mark as null-like so that glGetUniformLocation() knows to populate this again.
      program.uniformSizeAndIdsByName = {};
  
    }

  function _glShaderSource(shader, count, string, length) {
      var source = GL.getSource(shader, count, string, length);
  
      GLctx.shaderSource(GL.shaders[shader], source);
    }

  function computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
      function roundedToNextMultipleOf(x, y) {
        return (x + y - 1) & -y;
      }
      var plainRowSize = width * sizePerPixel;
      var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
      return height * alignedRowSize;
    }
  
  function __colorChannelsInGlTextureFormat(format) {
      // Micro-optimizations for size: map format to size by subtracting smallest enum value (0x1902) from all values first.
      // Also omit the most common size value (1) from the list, which is assumed by formats not on the list.
      var colorChannels = {
        // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
        // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
        5: 3,
        6: 4,
        // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
        8: 2,
        29502: 3,
        29504: 4,
        // 0x1903 /* GL_RED */ - 0x1902: 1,
        26917: 2,
        26918: 2,
        // 0x8D94 /* GL_RED_INTEGER */ - 0x1902: 1,
        29846: 3,
        29847: 4
      };
      return colorChannels[format - 0x1902]||1;
    }
  
  function heapObjectForWebGLType(type) {
      // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
      // smaller values for the heap, for shorter generated code size.
      // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
      // (since most types are HEAPU16)
      type -= 0x1400;
      if (type == 0) return HEAP8;
  
      if (type == 1) return HEAPU8;
  
      if (type == 2) return HEAP16;
  
      if (type == 4) return HEAP32;
  
      if (type == 6) return HEAPF32;
  
      if (type == 5
        || type == 28922
        || type == 28520
        || type == 30779
        || type == 30782
        )
        return HEAPU32;
  
      return HEAPU16;
    }
  
  function heapAccessShiftForWebGLHeap(heap) {
      return 31 - Math.clz32(heap.BYTES_PER_ELEMENT);
    }
  function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
      var heap = heapObjectForWebGLType(type);
      var shift = heapAccessShiftForWebGLHeap(heap);
      var byteSize = 1<<shift;
      var sizePerPixel = __colorChannelsInGlTextureFormat(format) * byteSize;
      var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
      return heap.subarray(pixels >> shift, pixels + bytes >> shift);
    }
  function _glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
      if (true) {
        // WebGL 2 provides new garbage-free entry points to call to WebGL. Use those always when possible.
        if (GLctx.currentPixelUnpackBufferBinding) {
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels);
        } else if (pixels) {
          var heap = heapObjectForWebGLType(type);
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, heap, pixels >> heapAccessShiftForWebGLHeap(heap));
        } else {
          GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, null);
        }
        return;
      }
      GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null);
    }

  function _glTexParameteri(x0, x1, x2) { GLctx['texParameteri'](x0, x1, x2) }

  function webglGetUniformLocation(location) {
      var p = GLctx.currentProgram;
  
      if (p) {
        var webglLoc = p.uniformLocsById[location];
        // p.uniformLocsById[location] stores either an integer, or a WebGLUniformLocation.
  
        // If an integer, we have not yet bound the location, so do it now. The integer value specifies the array index
        // we should bind to.
        if (typeof webglLoc === 'number') {
          p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(p, p.uniformArrayNamesById[location] + (webglLoc > 0 ? '[' + webglLoc + ']' : ''));
        }
        // Else an already cached WebGLUniformLocation, return it.
        return webglLoc;
      } else {
        GL.recordError(0x502/*GL_INVALID_OPERATION*/);
      }
    }
  function _glUniform1f(location, v0) {
      GLctx.uniform1f(webglGetUniformLocation(location), v0);
    }

  function _glUniform1i(location, v0) {
      GLctx.uniform1i(webglGetUniformLocation(location), v0);
    }

  function _glUniform2f(location, v0, v1) {
      GLctx.uniform2f(webglGetUniformLocation(location), v0, v1);
    }

  function _glUniform2i(location, v0, v1) {
      GLctx.uniform2i(webglGetUniformLocation(location), v0, v1);
    }

  function _glUseProgram(program) {
      program = GL.programs[program];
      GLctx.useProgram(program);
      // Record the currently active program so that we can access the uniform
      // mapping table of that program.
      GLctx.currentProgram = program;
    }

  function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
      var cb = GL.currentContext.clientBuffers[index];
      if (!GLctx.currentArrayBufferBinding) {
        cb.size = size;
        cb.type = type;
        cb.normalized = normalized;
        cb.stride = stride;
        cb.ptr = ptr;
        cb.clientside = true;
        cb.vertexAttribPointerAdaptor = function(index, size, type, normalized, stride, ptr) {
          this.vertexAttribPointer(index, size, type, normalized, stride, ptr);
        };
        return;
      }
      cb.clientside = false;
      GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
    }

  function _glViewport(x0, x1, x2, x3) { GLctx['viewport'](x0, x1, x2, x3) }

  function _gmtime_r(time, tmPtr) {
      var date = new Date(HEAP32[((time)>>2)]*1000);
      HEAP32[((tmPtr)>>2)] = date.getUTCSeconds();
      HEAP32[(((tmPtr)+(4))>>2)] = date.getUTCMinutes();
      HEAP32[(((tmPtr)+(8))>>2)] = date.getUTCHours();
      HEAP32[(((tmPtr)+(12))>>2)] = date.getUTCDate();
      HEAP32[(((tmPtr)+(16))>>2)] = date.getUTCMonth();
      HEAP32[(((tmPtr)+(20))>>2)] = date.getUTCFullYear()-1900;
      HEAP32[(((tmPtr)+(24))>>2)] = date.getUTCDay();
      HEAP32[(((tmPtr)+(36))>>2)] = 0;
      HEAP32[(((tmPtr)+(32))>>2)] = 0;
      var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
      var yday = ((date.getTime() - start) / (1000 * 60 * 60 * 24))|0;
      HEAP32[(((tmPtr)+(28))>>2)] = yday;
      // Allocate a string "GMT" for us to point to.
      if (!_gmtime_r.GMTString) _gmtime_r.GMTString = allocateUTF8("GMT");
      HEAP32[(((tmPtr)+(40))>>2)] = _gmtime_r.GMTString;
      return tmPtr;
    }

  function _llvm_eh_typeid_for(type) {
      return type;
    }

  function _tzset() {
      // TODO: Use (malleable) environment variables instead of system settings.
      if (_tzset.called) return;
      _tzset.called = true;
  
      var currentYear = new Date().getFullYear();
      var winter = new Date(currentYear, 0, 1);
      var summer = new Date(currentYear, 6, 1);
      var winterOffset = winter.getTimezoneOffset();
      var summerOffset = summer.getTimezoneOffset();
  
      // Local standard timezone offset. Local standard time is not adjusted for daylight savings.
      // This code uses the fact that getTimezoneOffset returns a greater value during Standard Time versus Daylight Saving Time (DST). 
      // Thus it determines the expected output during Standard Time, and it compares whether the output of the given date the same (Standard) or less (DST).
      var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
  
      // timezone is specified as seconds west of UTC ("The external variable
      // `timezone` shall be set to the difference, in seconds, between
      // Coordinated Universal Time (UTC) and local standard time."), the same
      // as returned by stdTimezoneOffset.
      // See http://pubs.opengroup.org/onlinepubs/009695399/functions/tzset.html
      HEAP32[((__get_timezone())>>2)] = stdTimezoneOffset * 60;
  
      HEAP32[((__get_daylight())>>2)] = Number(winterOffset != summerOffset);
  
      function extractZone(date) {
        var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
        return match ? match[1] : "GMT";
      };
      var winterName = extractZone(winter);
      var summerName = extractZone(summer);
      var winterNamePtr = allocateUTF8(winterName);
      var summerNamePtr = allocateUTF8(summerName);
      if (summerOffset < winterOffset) {
        // Northern hemisphere
        HEAP32[((__get_tzname())>>2)] = winterNamePtr;
        HEAP32[(((__get_tzname())+(4))>>2)] = summerNamePtr;
      } else {
        HEAP32[((__get_tzname())>>2)] = summerNamePtr;
        HEAP32[(((__get_tzname())+(4))>>2)] = winterNamePtr;
      }
    }
  function _localtime_r(time, tmPtr) {
      _tzset();
      var date = new Date(HEAP32[((time)>>2)]*1000);
      HEAP32[((tmPtr)>>2)] = date.getSeconds();
      HEAP32[(((tmPtr)+(4))>>2)] = date.getMinutes();
      HEAP32[(((tmPtr)+(8))>>2)] = date.getHours();
      HEAP32[(((tmPtr)+(12))>>2)] = date.getDate();
      HEAP32[(((tmPtr)+(16))>>2)] = date.getMonth();
      HEAP32[(((tmPtr)+(20))>>2)] = date.getFullYear()-1900;
      HEAP32[(((tmPtr)+(24))>>2)] = date.getDay();
  
      var start = new Date(date.getFullYear(), 0, 1);
      var yday = ((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))|0;
      HEAP32[(((tmPtr)+(28))>>2)] = yday;
      HEAP32[(((tmPtr)+(36))>>2)] = -(date.getTimezoneOffset() * 60);
  
      // Attention: DST is in December in South, and some regions don't have DST at all.
      var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
      var winterOffset = start.getTimezoneOffset();
      var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset))|0;
      HEAP32[(((tmPtr)+(32))>>2)] = dst;
  
      var zonePtr = HEAP32[(((__get_tzname())+(dst ? 4 : 0))>>2)];
      HEAP32[(((tmPtr)+(40))>>2)] = zonePtr;
  
      return tmPtr;
    }

  var MONO={pump_count:0,timeout_queue:[],spread_timers_maximum:0,_vt_stack:[],mono_wasm_runtime_is_ready:false,mono_wasm_ignore_pdb_load_errors:true,_id_table:{},pump_message:function () {
  			if (!this.mono_background_exec)
  				this.mono_background_exec = Module.cwrap ("mono_background_exec", null);
  			while (MONO.timeout_queue.length > 0) {
  				--MONO.pump_count;
  				MONO.timeout_queue.shift()();
  			}
  			while (MONO.pump_count > 0) {
  				--MONO.pump_count;
  				this.mono_background_exec ();
  			}
  		},export_functions:function (module) {
  			module ["pump_message"] = MONO.pump_message.bind(MONO);
  			module ["prevent_timer_throttling"] = MONO.prevent_timer_throttling.bind(MONO);
  			module ["mono_wasm_set_timeout_exec"] = MONO.mono_wasm_set_timeout_exec.bind(MONO);
  			module ["mono_load_runtime_and_bcl"] = MONO.mono_load_runtime_and_bcl.bind(MONO);
  			module ["mono_load_runtime_and_bcl_args"] = MONO.mono_load_runtime_and_bcl_args.bind(MONO);
  			module ["mono_wasm_load_bytes_into_heap"] = MONO.mono_wasm_load_bytes_into_heap.bind(MONO);
  			module ["mono_wasm_load_icu_data"] = MONO.mono_wasm_load_icu_data.bind(MONO);
  			module ["mono_wasm_get_icudt_name"] = MONO.mono_wasm_get_icudt_name.bind(MONO);
  			module ["mono_wasm_globalization_init"] = MONO.mono_wasm_globalization_init.bind(MONO);
  			module ["mono_wasm_get_loaded_files"] = MONO.mono_wasm_get_loaded_files.bind(MONO);
  			module ["mono_wasm_new_root_buffer"] = MONO.mono_wasm_new_root_buffer.bind(MONO);
  			module ["mono_wasm_new_root_buffer_from_pointer"] = MONO.mono_wasm_new_root_buffer_from_pointer.bind(MONO);
  			module ["mono_wasm_new_root"] = MONO.mono_wasm_new_root.bind(MONO);
  			module ["mono_wasm_new_roots"] = MONO.mono_wasm_new_roots.bind(MONO);
  			module ["mono_wasm_release_roots"] = MONO.mono_wasm_release_roots.bind(MONO);
  			module ["mono_wasm_load_config"] = MONO.mono_wasm_load_config.bind(MONO);
  		},_base64Converter:{_base64Table:["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9","+","/"],_makeByteReader:function (bytes, index, count) {
  				var position = (typeof (index) === "number") ? index : 0;
  				var endpoint;
  
  				if (typeof (count) === "number")
  					endpoint = (position + count);
  				else
  					endpoint = (bytes.length - position);
  
  				var result = {
  					read: function () {
  						if (position >= endpoint)
  							return false;
  
  						var nextByte = bytes[position];
  						position += 1;
  						return nextByte;
  					}
  				};
  
  				Object.defineProperty(result, "eof", {
  					get: function () {
  						return (position >= endpoint);
  					},
  					configurable: true,
  					enumerable: true
  				});
  
  				return result;
  			},toBase64StringImpl:function (inArray, offset, length) {
  				var reader = this._makeByteReader(inArray, offset, length);
  				var result = "";
  				var ch1 = 0, ch2 = 0, ch3 = 0, bits = 0, equalsCount = 0, sum = 0;
  				var mask1 = (1 << 24) - 1, mask2 = (1 << 18) - 1, mask3 = (1 << 12) - 1, mask4 = (1 << 6) - 1;
  				var shift1 = 18, shift2 = 12, shift3 = 6, shift4 = 0;
  
  				while (true) {
  					ch1 = reader.read();
  					ch2 = reader.read();
  					ch3 = reader.read();
  
  					if (ch1 === false)
  						break;
  					if (ch2 === false) {
  						ch2 = 0;
  						equalsCount += 1;
  					}
  					if (ch3 === false) {
  						ch3 = 0;
  						equalsCount += 1;
  					}
  
  					// Seems backwards, but is right!
  					sum = (ch1 << 16) | (ch2 << 8) | (ch3 << 0);
  
  					bits = (sum & mask1) >> shift1;
  					result += this._base64Table[bits];
  					bits = (sum & mask2) >> shift2;
  					result += this._base64Table[bits];
  
  					if (equalsCount < 2) {
  						bits = (sum & mask3) >> shift3;
  						result += this._base64Table[bits];
  					}
  
  					if (equalsCount === 2) {
  						result += "==";
  					} else if (equalsCount === 1) {
  						result += "=";
  					} else {
  						bits = (sum & mask4) >> shift4;
  						result += this._base64Table[bits];
  					}
  				}
  
  				return result;
  			}},_mono_wasm_root_buffer_prototype:{_throw_index_out_of_range:function () {
  				throw new Error ("index out of range");
  			},_check_in_range:function (index) {
  				if ((index >= this.__count) || (index < 0))
  					this._throw_index_out_of_range();
  			},get_address:function (index) {
  				this._check_in_range (index);
  				return this.__offset + (index * 4);
  			},get_address_32:function (index) {
  				this._check_in_range (index);
  				return this.__offset32 + index;
  			},get:function (index) {
  				this._check_in_range (index);
  				return Module.HEAP32[this.get_address_32 (index)];
  			},set:function (index, value) {
  				Module.HEAP32[this.get_address_32 (index)] = value;
  				return value;
  			},_unsafe_get:function (index) {
  				return Module.HEAP32[this.__offset32 + index];
  			},_unsafe_set:function (index, value) {
  				Module.HEAP32[this.__offset32 + index] = value;
  			},clear:function () {
  				if (this.__offset)
  					MONO._zero_region (this.__offset, this.__count * 4);
  			},release:function () {
  				if (this.__offset && this.__ownsAllocation) {
  					MONO.mono_wasm_deregister_root (this.__offset);
  					MONO._zero_region (this.__offset, this.__count * 4);
  					Module._free (this.__offset);
  				}
  
  				this.__handle = this.__offset = this.__count = this.__offset32 = 0;
  			},toString:function () {
  				return "[root buffer @" + this.get_address (0) + ", size " + this.__count + "]";
  			}},_scratch_root_buffer:null,_scratch_root_free_indices:null,_scratch_root_free_indices_count:0,_scratch_root_free_instances:[],_mono_wasm_root_prototype:{get_address:function () {
  				return this.__buffer.get_address (this.__index);
  			},get_address_32:function () {
  				return this.__buffer.get_address_32 (this.__index);
  			},get:function () {
  				var result = this.__buffer._unsafe_get (this.__index);
  				return result;
  			},set:function (value) {
  				this.__buffer._unsafe_set (this.__index, value);
  				return value;
  			},valueOf:function () {
  				return this.get ();
  			},clear:function () {
  				this.set (0);
  			},release:function () {
  				const maxPooledInstances = 128;
  				if (MONO._scratch_root_free_instances.length > maxPooledInstances) {
  					MONO._mono_wasm_release_scratch_index (this.__index);
  					this.__buffer = 0;
  					this.__index = 0;
  				} else {
  					this.set (0);
  					MONO._scratch_root_free_instances.push (this);
  				}
  			},toString:function () {
  				return "[root @" + this.get_address () + "]";
  			}},_mono_wasm_release_scratch_index:function (index) {
  			if (index === undefined)
  				return;
  
  			this._scratch_root_buffer.set (index, 0);
  			this._scratch_root_free_indices[this._scratch_root_free_indices_count] = index;
  			this._scratch_root_free_indices_count++;
  		},_mono_wasm_claim_scratch_index:function () {
  			if (!this._scratch_root_buffer) {
  				const maxScratchRoots = 8192;
  				this._scratch_root_buffer = this.mono_wasm_new_root_buffer (maxScratchRoots, "js roots");
  
  				this._scratch_root_free_indices = new Int32Array (maxScratchRoots);
  				this._scratch_root_free_indices_count = maxScratchRoots;
  				for (var i = 0; i < maxScratchRoots; i++)
  					this._scratch_root_free_indices[i] = maxScratchRoots - i - 1;
  
  				Object.defineProperty (this._mono_wasm_root_prototype, "value", {
  					get: this._mono_wasm_root_prototype.get,
  					set: this._mono_wasm_root_prototype.set,
  					configurable: false
  				});
  			}
  
  			if (this._scratch_root_free_indices_count < 1)
  				throw new Error ("Out of scratch root space");
  
  			var result = this._scratch_root_free_indices[this._scratch_root_free_indices_count - 1];
  			this._scratch_root_free_indices_count--;
  			return result;
  		},_zero_region:function (byteOffset, sizeBytes) {
  			if (((byteOffset % 4) === 0) && ((sizeBytes % 4) === 0))
  				Module.HEAP32.fill(0, byteOffset / 4, sizeBytes / 4);
  			else
  				Module.HEAP8.fill(0, byteOffset, sizeBytes);
  		},mono_wasm_new_root_buffer:function (capacity, msg) {
  			if (!this.mono_wasm_register_root || !this.mono_wasm_deregister_root) {
  				this.mono_wasm_register_root = Module.cwrap ("mono_wasm_register_root", "number", ["number", "number", "string"]);
  				this.mono_wasm_deregister_root = Module.cwrap ("mono_wasm_deregister_root", null, ["number"]);
  			}
  
  			if (capacity <= 0)
  				throw new Error ("capacity >= 1");
  
  			capacity = capacity | 0;
  
  			var capacityBytes = capacity * 4;
  			var offset = Module._malloc (capacityBytes);
  			if ((offset % 4) !== 0)
  				throw new Error ("Malloc returned an unaligned offset");
  
  			this._zero_region (offset, capacityBytes);
  
  			var result = Object.create (this._mono_wasm_root_buffer_prototype);
  			result.__offset = offset;
  			result.__offset32 = (offset / 4) | 0;
  			result.__count = capacity;
  			result.length = capacity;
  			result.__handle = this.mono_wasm_register_root (offset, capacityBytes, msg || 0);
  			result.__ownsAllocation = true;
  
  			return result;
  		},mono_wasm_new_root_buffer_from_pointer:function (offset, capacity, msg) {
  			if (!this.mono_wasm_register_root || !this.mono_wasm_deregister_root) {
  				this.mono_wasm_register_root = Module.cwrap ("mono_wasm_register_root", "number", ["number", "number", "string"]);
  				this.mono_wasm_deregister_root = Module.cwrap ("mono_wasm_deregister_root", null, ["number"]);
  			}
  
  			if (capacity <= 0)
  				throw new Error ("capacity >= 1");
  
  			capacity = capacity | 0;
  
  			var capacityBytes = capacity * 4;
  			if ((offset % 4) !== 0)
  				throw new Error ("Unaligned offset");
  
  			this._zero_region (offset, capacityBytes);
  
  			var result = Object.create (this._mono_wasm_root_buffer_prototype);
  			result.__offset = offset;
  			result.__offset32 = (offset / 4) | 0;
  			result.__count = capacity;
  			result.length = capacity;
  			result.__handle = this.mono_wasm_register_root (offset, capacityBytes, msg || 0);
  			result.__ownsAllocation = false;
  
  			return result;
  		},mono_wasm_new_root:function (value) {
  			var result;
  
  			if (this._scratch_root_free_instances.length > 0) {
  				result = this._scratch_root_free_instances.pop ();
  			} else {
  				var index = this._mono_wasm_claim_scratch_index ();
  				var buffer = this._scratch_root_buffer;
  
  				result = Object.create (this._mono_wasm_root_prototype);
  				result.__buffer = buffer;
  				result.__index = index;
  			}
  
  			if (value !== undefined) {
  				if (typeof (value) !== "number")
  					throw new Error ("value must be an address in the managed heap");
  
  				result.set (value);
  			} else {
  				result.set (0);
  			}
  
  			return result;
  		},mono_wasm_new_roots:function (count_or_values) {
  			var result;
  
  			if (Array.isArray (count_or_values)) {
  				result = new Array (count_or_values.length);
  				for (var i = 0; i < result.length; i++)
  					result[i] = this.mono_wasm_new_root (count_or_values[i]);
  			} else if ((count_or_values | 0) > 0) {
  				result = new Array (count_or_values);
  				for (var i = 0; i < result.length; i++)
  					result[i] = this.mono_wasm_new_root ();
  			} else {
  				throw new Error ("count_or_values must be either an array or a number greater than 0");
  			}
  
  			return result;
  		},mono_wasm_release_roots:function () {
  			for (var i = 0; i < arguments.length; i++) {
  				if (!arguments[i])
  					continue;
  
  				arguments[i].release ();
  			}
  		},mono_text_decoder:undefined,string_decoder:{copy:function (mono_string) {
  				if (mono_string === 0)
  					return null;
  
  				if (!this.mono_wasm_string_root)
  					this.mono_wasm_string_root = MONO.mono_wasm_new_root ();
  				this.mono_wasm_string_root.value = mono_string;
  
  				if (!this.mono_wasm_string_get_data)
  					this.mono_wasm_string_get_data = Module.cwrap ("mono_wasm_string_get_data", null, ['number', 'number', 'number', 'number']);
  				
  				if (!this.mono_wasm_string_decoder_buffer)
  					this.mono_wasm_string_decoder_buffer = Module._malloc(12);
  				
  				let ppChars = this.mono_wasm_string_decoder_buffer + 0,
  					pLengthBytes = this.mono_wasm_string_decoder_buffer + 4,
  					pIsInterned = this.mono_wasm_string_decoder_buffer + 8;
  				
  				this.mono_wasm_string_get_data (mono_string, ppChars, pLengthBytes, pIsInterned);
  
  				// TODO: Is this necessary?
  				if (!this.mono_wasm_empty_string)
  					this.mono_wasm_empty_string = "";
  
  				let result = this.mono_wasm_empty_string;
  				let lengthBytes = Module.HEAP32[pLengthBytes / 4],
  					pChars = Module.HEAP32[ppChars / 4],
  					isInterned = Module.HEAP32[pIsInterned / 4];
  
  				if (pLengthBytes && pChars) {
  					if (
  						isInterned && 
  						MONO.interned_string_table && 
  						MONO.interned_string_table.has(mono_string)
  					) {
  						result = MONO.interned_string_table.get(mono_string);
  						// console.log("intern table cache hit", mono_string, result.length);
  					} else {
  						result = this.decode(pChars, pChars + lengthBytes, false);
  						if (isInterned) {
  							if (!MONO.interned_string_table)
  								MONO.interned_string_table = new Map();
  							// console.log("interned", mono_string, result.length);
  							MONO.interned_string_table.set(mono_string, result);
  						}
  					}						
  				}
  
  				this.mono_wasm_string_root.value = 0;
  				return result;
  			},decode:function (start, end, save) {
  				if (!MONO.mono_text_decoder) {
  					MONO.mono_text_decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
  				}
  
  				var str = "";
  				if (MONO.mono_text_decoder) {
  					// When threading is enabled, TextDecoder does not accept a view of a
  					// SharedArrayBuffer, we must make a copy of the array first.
  					var subArray = typeof SharedArrayBuffer !== 'undefined' && Module.HEAPU8.buffer instanceof SharedArrayBuffer
  						? Module.HEAPU8.slice(start, end)
  						: Module.HEAPU8.subarray(start, end);
  
  					str = MONO.mono_text_decoder.decode(subArray);
  				} else {
  					for (var i = 0; i < end - start; i+=2) {
  						var char = Module.getValue (start + i, 'i16');
  						str += String.fromCharCode (char);
  					}
  				}
  				if (save)
  					this.result = str;
  
  				return str;
  			}},mono_wasm_add_dbg_command_received:function(res_ok, id, buffer, buffer_len) 
  		{
  			const assembly_data = new Uint8Array(Module.HEAPU8.buffer, buffer, buffer_len);
  			const base64String = MONO._base64Converter.toBase64StringImpl(assembly_data);
  			const buffer_obj = {
  				res_ok,
  				res: {
  						id,
  						value: base64String
  				}
  			}
  			if (MONO.commands_received.has(id))
          		console.warn("Addind an id that already exists in commands_received");
  			MONO.commands_received.set(id, buffer_obj);
  		},mono_wasm_malloc_and_set_debug_buffer:function (command_parameters)
  		{
  			if (command_parameters.length > this._debugger_buffer_len)
  			{
  				if (this._debugger_buffer)
  					Module._free (this._debugger_buffer);
  				this._debugger_buffer_len = Math.max(command_parameters.length, this._debugger_buffer_len, 256);
  				this._debugger_buffer = Module._malloc (this._debugger_buffer_len);
  			}
  			this._debugger_heap_bytes = new Uint8Array (Module.HEAPU8.buffer, this._debugger_buffer, this._debugger_buffer_len);
  			this._debugger_heap_bytes.set(this._base64_to_uint8 (command_parameters));
  		},mono_wasm_send_dbg_command_with_parms:function (id, command_set, command, command_parameters, length, valtype, newvalue)
  		{
  			this.mono_wasm_malloc_and_set_debug_buffer(command_parameters);
  			this._c_fn_table.mono_wasm_send_dbg_command_with_parms_wrapper (id, command_set, command, this._debugger_buffer, length, valtype, newvalue.toString());
  			let { res_ok, res } =  MONO.commands_received.remove(id);;
  			if (!res_ok)
  				throw new Error (`Failed on mono_wasm_invoke_method_debugger_agent_with_parms`);
  			return res;
  		},mono_wasm_send_dbg_command:function (id, command_set, command, command_parameters)
  		{
  			this.mono_wasm_malloc_and_set_debug_buffer(command_parameters);
  			this._c_fn_table.mono_wasm_send_dbg_command_wrapper (id, command_set, command, this._debugger_buffer, command_parameters.length);
  			let { res_ok, res } =  MONO.commands_received.remove(id);
  			if (!res_ok)
  				throw new Error (`Failed on mono_wasm_send_dbg_command`);
  			return res;
  
  		},mono_wasm_get_dbg_command_info:function ()
  		{
  			let { res_ok, res } =  MONO.commands_received.remove(0);
  			if (!res_ok)
  				throw new Error (`Failed on mono_wasm_get_dbg_command_info`);
  			return res;
  		},_get_cfo_res_details:function (objectId, args) {
  			if (!(objectId in this._call_function_res_cache))
  				throw new Error(`Could not find any object with id ${objectId}`);
  
  			const real_obj = this._call_function_res_cache [objectId];
  
  			const descriptors = Object.getOwnPropertyDescriptors (real_obj);
  			if (args.accessorPropertiesOnly) {
  				Object.keys (descriptors).forEach (k => {
  					if (descriptors [k].get === undefined)
  						Reflect.deleteProperty (descriptors, k);
  				});
  			}
  
  			let res_details = [];
  			Object.keys (descriptors).forEach (k => {
  				let new_obj;
  				let prop_desc = descriptors [k];
  				if (typeof prop_desc.value == "object") {
  					// convert `{value: { type='object', ... }}`
  					// to      `{ name: 'foo', value: { type='object', ... }}
  					new_obj = Object.assign ({ name: k }, prop_desc);
  				} else if (prop_desc.value !== undefined) {
  					// This is needed for values that were not added by us,
  					// thus are like { value: 5 }
  					// instead of    { value: { type = 'number', value: 5 }}
  					//
  					// This can happen, for eg., when `length` gets added for arrays
  					// or `__proto__`.
  					new_obj = {
  						name: k,
  						// merge/add `type` and `description` to `d.value`
  						value: Object.assign ({ type: (typeof prop_desc.value), description: '' + prop_desc.value },
  												prop_desc)
  					};
  				} else if (prop_desc.get !== undefined) {
  					// The real_obj has the actual getter. We are just returning a placeholder
  					// If the caller tries to run function on the cfo_res object,
  					// that accesses this property, then it would be run on `real_obj`,
  					// which *has* the original getter
  					new_obj = {
  						name: k,
  						get: {
  							className: "Function",
  							description: `get ${k} () {}`,
  							type: "function"
  						}
  					};
  				} else {
  					new_obj = { name: k, value: { type: "symbol", value: "<Unknown>", description: "<Unknown>"} };
  				}
  
  				res_details.push (new_obj);
  			});
  
  			return { __value_as_json_string__: JSON.stringify (res_details) };
  		},mono_wasm_get_details:function (objectId, args={}) {
  				return this._get_cfo_res_details (`dotnet:cfo_res:${objectId}`, args);
  		},_cache_call_function_res:function (obj) {
  			const id = `dotnet:cfo_res:${this._next_call_function_res_id++}`;
  			this._call_function_res_cache[id] = obj;
  			return id;
  		},mono_wasm_release_object:function (objectId) {
  			if (objectId in this._cache_call_function_res)
  				delete this._cache_call_function_res[objectId];
  		},_create_proxy_from_object_id:function (objectId, details) {
  			if (objectId.startsWith ('dotnet:array:'))
  			{
  				if (details.items === undefined)
  				{
  					const ret = details.map (p => p.value);
  					return ret;
  				}
  				if (details.dimensionsDetails == undefined || details.dimensionsDetails.length == 1)
  				{
  					const ret = details.items.map (p => p.value);
  					return ret;
  				}
  			}
  
  			let proxy = {};
  			Object.keys (details).forEach (p => {
  				var prop = details [p];
  				if (prop.get !== undefined) {
  					Object.defineProperty (proxy,
  							prop.name,
  							{ get () { return MONO.mono_wasm_send_dbg_command(prop.get.id, prop.get.commandSet, prop.get.command, prop.get.buffer, prop.get.length); },
  							set: function (newValue) { MONO.mono_wasm_send_dbg_command_with_parms(prop.set.id, prop.set.commandSet, prop.set.command, prop.set.buffer, prop.set.length, prop.set.valtype, newValue); return true;}}
  					);
  				} else if (prop.set !== undefined ){
  					Object.defineProperty (proxy,
  						prop.name,
  						{ get () { return prop.value; },
  						  set: function (newValue) { MONO.mono_wasm_send_dbg_command_with_parms(prop.set.id, prop.set.commandSet, prop.set.command, prop.set.buffer, prop.set.length, prop.set.valtype, newValue); return true;}}
  					);
  				} else {
  					proxy [prop.name] = prop.value;
  				}
  			});
  			return proxy;
  		},mono_wasm_call_function_on:function (request) {
  			if (request.arguments != undefined && !Array.isArray (request.arguments))
  				throw new Error (`"arguments" should be an array, but was ${request.arguments}`);
  
  			const objId = request.objectId;
  			const details = request.details;
  			let proxy;
  
  			if (objId.startsWith ('dotnet:cfo_res:')) {
  				if (objId in this._call_function_res_cache)
  					proxy = this._call_function_res_cache [objId];
  				else
  					throw new Error (`Unknown object id ${objId}`);
  			} else {
  				proxy = this._create_proxy_from_object_id (objId, details);
  			}
  
  			const fn_args = request.arguments != undefined ? request.arguments.map(a => JSON.stringify(a.value)) : [];
  			const fn_eval_str = `var fn = ${request.functionDeclaration}; fn.call (proxy, ...[${fn_args}]);`;
  
  			const fn_res = eval (fn_eval_str);
  			if (fn_res === undefined)
  				return { type: "undefined" };
  
  			if (Object (fn_res) !== fn_res)
  			{
  				if (typeof(fn_res) == "object" && fn_res == null)
  					return { type: typeof(fn_res), subtype: `${fn_res}`, value: null };
  				return { type: typeof(fn_res), description: `${fn_res}`, value: `${fn_res}`};
  			}
  
  			if (request.returnByValue && fn_res.subtype == undefined)
  				return {type: "object", value: fn_res};
  			if (Object.getPrototypeOf (fn_res) == Array.prototype) {
  
  				const fn_res_id = this._cache_call_function_res (fn_res);
  
  				return {
  					type: "object",
  					subtype: "array",
  					className: "Array",
  					description: `Array(${fn_res.length})`,
  					objectId: fn_res_id
  				};
  			}
  			if (fn_res.value !== undefined || fn_res.subtype !== undefined) {
  				return fn_res;
  			}
  
  			if (fn_res == proxy)
  				return { type: "object", className: "Object", description: "Object", objectId: objId };
  			const fn_res_id = this._cache_call_function_res (fn_res);
  			return { type: "object", className: "Object", description: "Object", objectId: fn_res_id };
  		},_clear_per_step_state:function () {
  			this._next_id_var = 0;
  			this._id_table = {};
  		},mono_wasm_debugger_resume:function () {
  			this._clear_per_step_state ();
  		},mono_wasm_detach_debugger:function () {
  			if (!this.mono_wasm_set_is_debugger_attached)
  				this.mono_wasm_set_is_debugger_attached = Module.cwrap ('mono_wasm_set_is_debugger_attached', 'void', ['bool']);
  			this.mono_wasm_set_is_debugger_attached(false);
  		},_register_c_fn:function (name, ...args) {
  			Object.defineProperty (this._c_fn_table, name + '_wrapper', { value: Module.cwrap (name, ...args) });
  		},_register_c_var_fn:function (name, ret_type, params) {
  			if (ret_type !== 'bool')
  				throw new Error (`Bug: Expected a C function signature that returns bool`);
  
  			this._register_c_fn (name, ret_type, params);
  			Object.defineProperty (this, name + '_info', {
  				value: function (...args) {
  					MONO.var_info = [];
  					const res_ok = MONO._c_fn_table [name + '_wrapper'] (...args);
  					let res = MONO.var_info;
  					MONO.var_info = [];
  					if (res_ok) {
  						res = this._fixup_name_value_objects (res);
  						return { res_ok, res };
  					}
  
  					return { res_ok, res: undefined };
  				}
  			});
  		},mono_wasm_runtime_ready:function () {
  			MONO.commands_received = new Map();
  			MONO.commands_received.remove = function (key) { const value = this.get(key); this.delete(key); return value;};
  			this.mono_wasm_runtime_is_ready = true;
  			this._clear_per_step_state ();
  
  			// FIXME: where should this go?
  			this._next_call_function_res_id = 0;
  			this._call_function_res_cache = {};
  
  			this._c_fn_table = {};
  			this._register_c_fn     ('mono_wasm_send_dbg_command',							'bool', [ 'number', 'number', 'number', 'number', 'number' ]);
  			this._register_c_fn     ('mono_wasm_send_dbg_command_with_parms', 				'bool', [ 'number', 'number', 'number', 'number', 'number', 'number', 'string' ]);
  			this._debugger_buffer_len = -1;
  			// DO NOT REMOVE - magic debugger init function
  			if (globalThis.dotnetDebugger)
  				debugger;
  			else
  				console.debug ("mono_wasm_runtime_ready", "fe00e07a-5519-4dfe-b35a-f867dbaf2e28");
  		},mono_wasm_setenv:function (name, value) {
  			if (!this.wasm_setenv)
  				this.wasm_setenv = Module.cwrap ('mono_wasm_setenv', null, ['string', 'string']);
  			this.wasm_setenv (name, value);
  		},mono_wasm_set_runtime_options:function (options) {
  			if (!this.wasm_parse_runtime_options)
  				this.wasm_parse_runtime_options = Module.cwrap ('mono_wasm_parse_runtime_options', null, ['number', 'number']);
  			var argv = Module._malloc (options.length * 4);
  			var wasm_strdup = Module.cwrap ('mono_wasm_strdup', 'number', ['string']);
  			let aindex = 0;
  			for (var i = 0; i < options.length; ++i) {
  				Module.setValue (argv + (aindex * 4), wasm_strdup (options [i]), "i32");
  				aindex += 1;
  			}
  			this.wasm_parse_runtime_options (options.length, argv);
  		},mono_wasm_init_aot_profiler:function (options) {
  			if (options == null)
  				options = {}
  			if (!('write_at' in options))
  				options.write_at = 'Interop/Runtime::StopProfile';
  			if (!('send_to' in options))
  				options.send_to = 'Interop/Runtime::DumpAotProfileData';
  			var arg = "aot:write-at-method=" + options.write_at + ",send-to-method=" + options.send_to;
  			Module.ccall ('mono_wasm_load_profiler_aot', null, ['string'], [arg]);
  		},mono_wasm_init_coverage_profiler:function (options) {
  			if (options == null)
  				options = {}
  			if (!('write_at' in options))
  				options.write_at = 'WebAssembly.Runtime::StopProfile';
  			if (!('send_to' in options))
  				options.send_to = 'WebAssembly.Runtime::DumpCoverageProfileData';
  			var arg = "coverage:write-at-method=" + options.write_at + ",send-to-method=" + options.send_to;
  			Module.ccall ('mono_wasm_load_profiler_coverage', null, ['string'], [arg]);
  		},_apply_configuration_from_args:function (args) {
  			for (var k in (args.environment_variables || {}))
  				MONO.mono_wasm_setenv (k, args.environment_variables[k]);
  
  			if (args.runtime_options)
  				MONO.mono_wasm_set_runtime_options (args.runtime_options);
  
  			if (args.aot_profiler_options)
  				MONO.mono_wasm_init_aot_profiler (args.aot_profiler_options);
  
  			if (args.coverage_profiler_options)
  				MONO.mono_wasm_init_coverage_profiler (args.coverage_profiler_options);
  		},_get_fetch_file_cb_from_args:function (args) {
  			if (typeof (args.fetch_file_cb) === "function")
  				return args.fetch_file_cb;
  
  			if (ENVIRONMENT_IS_NODE) {
  				var fs = require('fs');
  				return function (asset) {
  					console.debug ("MONO_WASM: Loading... " + asset);
  					var binary = fs.readFileSync (asset);
  					var resolve_func2 = function (resolve, reject) {
  						resolve (new Uint8Array (binary));
  					};
  
  					var resolve_func1 = function (resolve, reject) {
  						var response = {
  							ok: true,
  							url: asset,
  							arrayBuffer: function () {
  								return new Promise (resolve_func2);
  							}
  						};
  						resolve (response);
  					};
  
  					return new Promise (resolve_func1);
  				};
  			} else if (typeof (fetch) === "function") {
  				return function (asset) {
  					return fetch (asset, { credentials: 'same-origin' });
  				};
  			} else {
  				throw new Error ("No fetch_file_cb was provided and this environment does not expose 'fetch'.");
  			}
  		},_handle_loaded_asset:function (ctx, asset, url, blob) {
  			var bytes = new Uint8Array (blob);
  			if (ctx.tracing)
  				console.log ("MONO_WASM: Loaded:", asset.name, "size", bytes.length, "from", url);
  
  			var virtualName = asset.virtual_path || asset.name;
  			var offset = null;
  
  			switch (asset.behavior) {
  				case "resource":
  				case "assembly":
  					ctx.loaded_files.push ({ url: url, file: virtualName});
  				case "heap":
  				case "icu":
  					offset = this.mono_wasm_load_bytes_into_heap (bytes);
  					ctx.loaded_assets[virtualName] = [offset, bytes.length];
  					break;
  
  				case "vfs":
  					// FIXME
  					var lastSlash = virtualName.lastIndexOf("/");
  					var parentDirectory = (lastSlash > 0)
  						? virtualName.substr(0, lastSlash)
  						: null;
  					var fileName = (lastSlash > 0)
  						? virtualName.substr(lastSlash + 1)
  						: virtualName;
  					if (fileName.startsWith("/"))
  						fileName = fileName.substr(1);
  					if (parentDirectory) {
  						if (ctx.tracing)
  							console.log ("MONO_WASM: Creating directory '" + parentDirectory + "'");
  
  						var pathRet = ctx.createPath(
  							"/", parentDirectory, true, true // fixme: should canWrite be false?
  						);
  					} else {
  						parentDirectory = "/";
  					}
  
  					if (ctx.tracing)
  						console.log ("MONO_WASM: Creating file '" + fileName + "' in directory '" + parentDirectory + "'");
  
  					if (!this.mono_wasm_load_data_archive (bytes, parentDirectory)) {
  						var fileRet = ctx.createDataFile (
  							parentDirectory, fileName,
  							bytes, true /* canRead */, true /* canWrite */, true /* canOwn */
  						);
  					}
  					break;
  
  				default:
  					throw new Error ("Unrecognized asset behavior:", asset.behavior, "for asset", asset.name);
  			}
  
  			if (asset.behavior === "assembly") {
  				var hasPpdb = ctx.mono_wasm_add_assembly (virtualName, offset, bytes.length);
  
  				if (!hasPpdb) {
  					var index = ctx.loaded_files.findIndex(element => element.file == virtualName);
  					ctx.loaded_files.splice(index, 1);
  				}
  			}
  			else if (asset.behavior === "icu") {
  				if (this.mono_wasm_load_icu_data (offset))
  					ctx.num_icu_assets_loaded_successfully += 1;
  				else
  					console.error ("Error loading ICU asset", asset.name);
  			}
  			else if (asset.behavior === "resource") {
  				ctx.mono_wasm_add_satellite_assembly (virtualName, asset.culture, offset, bytes.length);
  			}
  		},mono_load_runtime_and_bcl:function (
  			unused_vfs_prefix, deploy_prefix, debug_level, file_list, loaded_cb, fetch_file_cb
  		) {
  			var args = {
  				fetch_file_cb: fetch_file_cb,
  				loaded_cb: loaded_cb,
  				debug_level: debug_level,
  				assembly_root: deploy_prefix,
  				assets: []
  			};
  
  			for (var i = 0; i < file_list.length; i++) {
  				var file_name = file_list[i];
  				var behavior;
  				if (file_name.startsWith ("icudt") && file_name.endsWith (".dat")) {
  					// ICU data files are expected to be "icudt%FilterName%.dat"
  					behavior = "icu";
  				} else { // if (file_name.endsWith (".pdb") || file_name.endsWith (".dll"))
  					behavior = "assembly";
  				}
  
  				args.assets.push ({
  					name: file_name,
  					behavior: behavior
  				});
  			}
  
  			return this.mono_load_runtime_and_bcl_args (args);
  		},mono_load_runtime_and_bcl_args:function (args) {
  			try {
  				return this._load_assets_and_runtime (args);
  			} catch (exc) {
  				console.error ("error in mono_load_runtime_and_bcl_args:", exc);
  				throw exc;
  			}
  		},mono_wasm_load_bytes_into_heap:function (bytes) {
  			var memoryOffset = Module._malloc (bytes.length);
  			var heapBytes = new Uint8Array (Module.HEAPU8.buffer, memoryOffset, bytes.length);
  			heapBytes.set (bytes);
  			return memoryOffset;
  		},num_icu_assets_loaded_successfully:0,mono_wasm_load_icu_data:function (offset) {
  			var fn = Module.cwrap ('mono_wasm_load_icu_data', 'number', ['number']);
  			var ok = (fn (offset)) === 1;
  			if (ok)
  				this.num_icu_assets_loaded_successfully++;
  			return ok;
  		},mono_wasm_get_icudt_name:function (culture) {
  			return Module.ccall ('mono_wasm_get_icudt_name', 'string', ['string'], [culture]);
  		},_finalize_startup:function (args, ctx) {
  			var loaded_files_with_debug_info = [];
  
  			MONO.loaded_assets = ctx.loaded_assets;
  			ctx.loaded_files.forEach(value => loaded_files_with_debug_info.push(value.url));
  			MONO.loaded_files = loaded_files_with_debug_info;
  			if (ctx.tracing) {
  				console.log ("MONO_WASM: loaded_assets: " + JSON.stringify(ctx.loaded_assets));
  				console.log ("MONO_WASM: loaded_files: " + JSON.stringify(ctx.loaded_files));
  			}
  
  			var load_runtime = Module.cwrap ('mono_wasm_load_runtime', null, ['string', 'number']);
  
  			console.debug ("MONO_WASM: Initializing mono runtime");
  
  			this.mono_wasm_globalization_init (args.globalization_mode);
  
  			if (ENVIRONMENT_IS_SHELL || ENVIRONMENT_IS_NODE) {
  				try {
  					load_runtime ("unused", args.debug_level);
  				} catch (ex) {
  					print ("MONO_WASM: load_runtime () failed: " + ex);
  					print ("MONO_WASM: Stacktrace: \n");
  					print (ex.stack);
  
  					var wasm_exit = Module.cwrap ('mono_wasm_exit', null, ['number']);
  					wasm_exit (1);
  				}
  			} else {
  				load_runtime ("unused", args.debug_level);
  			}
  
  			let tz;
  			try {
  				tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  			} catch {}
  			MONO.mono_wasm_setenv ("TZ", tz || "UTC");
  			MONO.mono_wasm_runtime_ready ();
  			args.loaded_cb ();
  		},_load_assets_and_runtime:function (args) {
  			if (args.enable_debugging)
  				args.debug_level = args.enable_debugging;
  			if (args.assembly_list)
  				throw new Error ("Invalid args (assembly_list was replaced by assets)");
  			if (args.runtime_assets)
  				throw new Error ("Invalid args (runtime_assets was replaced by assets)");
  			if (args.runtime_asset_sources)
  				throw new Error ("Invalid args (runtime_asset_sources was replaced by remote_sources)");
  			if (!args.loaded_cb)
  				throw new Error ("loaded_cb not provided");
  
  			var ctx = {
  				tracing: args.diagnostic_tracing || false,
  				pending_count: args.assets.length,
  				mono_wasm_add_assembly: Module.cwrap ('mono_wasm_add_assembly', 'number', ['string', 'number', 'number']),
  				mono_wasm_add_satellite_assembly: Module.cwrap ('mono_wasm_add_satellite_assembly', 'void', ['string', 'string', 'number', 'number']),
  				loaded_assets: Object.create (null),
  				// dlls and pdbs, used by blazor and the debugger
  				loaded_files: [],
  				createPath: Module['FS_createPath'],
  				createDataFile: Module['FS_createDataFile']
  			};
  
  			if (ctx.tracing)
  				console.log ("mono_wasm_load_runtime_with_args", JSON.stringify(args));
  
  			this._apply_configuration_from_args (args);
  
  			var fetch_file_cb = this._get_fetch_file_cb_from_args (args);
  
  			var onPendingRequestComplete = function () {
  				--ctx.pending_count;
  
  				if (ctx.pending_count === 0) {
  					try {
  						MONO._finalize_startup (args, ctx);
  					} catch (exc) {
  						console.error ("Unhandled exception in _finalize_startup", exc);
  						throw exc;
  					}
  				}
  			};
  
  			var processFetchResponseBuffer = function (asset, url, blob) {
  				try {
  					MONO._handle_loaded_asset (ctx, asset, url, blob);
  				} catch (exc) {
  					console.error ("Unhandled exception in processFetchResponseBuffer", exc);
  					throw exc;
  				} finally {
  					onPendingRequestComplete ();
  				}
  			};
  
  			args.assets.forEach (function (asset) {
  				var attemptNextSource;
  				var sourceIndex = 0;
  				var sourcesList = asset.load_remote ? args.remote_sources : [""];
  
  				var handleFetchResponse = function (response) {
  					if (!response.ok) {
  						try {
  							attemptNextSource ();
  							return;
  						} catch (exc) {
  							console.error ("MONO_WASM: Unhandled exception in handleFetchResponse attemptNextSource for asset", asset.name, exc);
  							throw exc;
  						}
  					}
  
  					try {
  						var bufferPromise = response ['arrayBuffer'] ();
  						bufferPromise.then (processFetchResponseBuffer.bind (this, asset, response.url));
  					} catch (exc) {
  						console.error ("MONO_WASM: Unhandled exception in handleFetchResponse for asset", asset.name, exc);
  						attemptNextSource ();
  					}
  				};
  
  				attemptNextSource = function () {
  					if (sourceIndex >= sourcesList.length) {
  						var msg = "MONO_WASM: Failed to load " + asset.name;
  						try {
  							var isOk = asset.is_optional ||
  								(asset.name.match (/\.pdb$/) && MONO.mono_wasm_ignore_pdb_load_errors);
  
  							if (isOk)
  								console.debug (msg);
  							else {
  								console.error (msg);
  								throw new Error (msg);
  							}
  						} finally {
  							onPendingRequestComplete ();
  						}
  					}
  
  					var sourcePrefix = sourcesList[sourceIndex];
  					sourceIndex++;
  
  					// HACK: Special-case because MSBuild doesn't allow "" as an attribute
  					if (sourcePrefix === "./")
  						sourcePrefix = "";
  
  					var attemptUrl;
  					if (sourcePrefix.trim() === "") {
  						if (asset.behavior === "assembly")
  							attemptUrl = locateFile (args.assembly_root + "/" + asset.name);
  						else if (asset.behavior === "resource") {
  							var path = asset.culture !== '' ? `${asset.culture}/${asset.name}` : asset.name;
  							attemptUrl = locateFile (args.assembly_root + "/" + path);
  						}
  						else
  							attemptUrl = asset.name;
  					} else {
  						attemptUrl = sourcePrefix + asset.name;
  					}
  
  					try {
  						if (asset.name === attemptUrl) {
  							if (ctx.tracing)
  								console.log ("Attempting to fetch '%s'", attemptUrl);
  						} else {
  							if (ctx.tracing)
  								console.log ("Attempting to fetch '%s' for '%s'", attemptUrl, asset.name);
  						}
  						var fetch_promise = fetch_file_cb (attemptUrl);
  						fetch_promise.then (handleFetchResponse);
  					} catch (exc) {
  						console.error ("MONO_WASM: Error fetching '%s'\n%s", attemptUrl, exc);
  						attemptNextSource ();
  					}
  				};
  
  				attemptNextSource ();
  			});
  		},mono_wasm_globalization_init:function (globalization_mode) {
  			var invariantMode = false;
  
  			if (globalization_mode === "invariant")
  				invariantMode = true;
  
  			if (!invariantMode) {
  				if (this.num_icu_assets_loaded_successfully > 0) {
  					console.debug ("MONO_WASM: ICU data archive(s) loaded, disabling invariant mode");
  				} else if (globalization_mode !== "icu") {
  					console.debug ("MONO_WASM: ICU data archive(s) not loaded, using invariant globalization mode");
  					invariantMode = true;
  				} else {
  					var msg = "invariant globalization mode is inactive and no ICU data archives were loaded";
  					console.error ("MONO_WASM: ERROR: " + msg);
  					throw new Error (msg);
  				}
  			}
  
  			if (invariantMode)
  				this.mono_wasm_setenv ("DOTNET_SYSTEM_GLOBALIZATION_INVARIANT", "1");
  
  			// Set globalization mode to PredefinedCulturesOnly
  			this.mono_wasm_setenv ("DOTNET_SYSTEM_GLOBALIZATION_PREDEFINED_CULTURES_ONLY", "1");
  		},mono_wasm_get_loaded_files:function() {
  			if (!this.mono_wasm_set_is_debugger_attached)
  				this.mono_wasm_set_is_debugger_attached = Module.cwrap ('mono_wasm_set_is_debugger_attached', 'void', ['bool']);
  			this.mono_wasm_set_is_debugger_attached (true);
  			return MONO.loaded_files;
  		},mono_wasm_get_loaded_asset_table:function() {
  			return MONO.loaded_assets;
  		},_base64_to_uint8:function (base64String) {
  			const byteCharacters = atob (base64String);
  			const byteNumbers = new Array(byteCharacters.length);
  			for (let i = 0; i < byteCharacters.length; i++) {
  				byteNumbers[i] = byteCharacters.charCodeAt(i);
  			}
  
  			return new Uint8Array (byteNumbers);
  		},mono_wasm_load_data_archive:function (data, prefix) {
  			if (data.length < 8)
  				return false;
  
  			var dataview = new DataView(data.buffer);
  			var magic = dataview.getUint32(0, true);
  			//	get magic number
  			if (magic != 0x626c6174) {
  				return false;
  			}
  			var manifestSize = dataview.getUint32(4, true);
  			if (manifestSize == 0 || data.length < manifestSize + 8)
  				return false;
  
  			var manifest;
  			try {
  				manifestContent = Module.UTF8ArrayToString(data, 8, manifestSize);
  				manifest = JSON.parse(manifestContent);
  				if (!(manifest instanceof Array))
  					return false;
  			} catch (exc) {
  				return false;
  			}
  
  			data = data.slice(manifestSize+8);
  
  			// Create the folder structure
  			// /usr/share/zoneinfo
  			// /usr/share/zoneinfo/Africa
  			// /usr/share/zoneinfo/Asia
  			// ..
  
  			var folders = new Set()
  			manifest.filter(m => {
  				var file = m[0];
  				var last = file.lastIndexOf ("/");
  				var directory = file.slice (0, last+1);
  				folders.add(directory);
  			});
  			folders.forEach(folder => {
  				Module['FS_createPath'](prefix, folder, true, true);
  			});
  
  			for (row of manifest) {
  				var name = row[0];
  				var length = row[1];
  				var bytes = data.slice(0, length);
  				Module['FS_createDataFile'](prefix, name, bytes, true, true);
  				data = data.slice(length);
  			}
  			return true;
  		},mono_wasm_raise_debug_event:function(event, args={}) {
  			if (typeof event !== 'object')
  				throw new Error(`event must be an object, but got ${JSON.stringify(event)}`);
  
  			if (event.eventName === undefined)
  				throw new Error(`event.eventName is a required parameter, in event: ${JSON.stringify(event)}`);
  
  			if (typeof args !== 'object')
  				throw new Error(`args must be an object, but got ${JSON.stringify(args)}`);
  
  			console.debug('mono_wasm_debug_event_raised:aef14bca-5519-4dfe-b35a-f867abc123ae', JSON.stringify(event), JSON.stringify(args));
  		},mono_wasm_load_config:async function (configFilePath) {
  			Module.addRunDependency(configFilePath);	
  			try {
  				let config = null;
  				// NOTE: when we add nodejs make sure to include the nodejs fetch package
  				if (ENVIRONMENT_IS_WEB) {
  					const configRaw = await fetch(configFilePath);
  					config = await configRaw.json();
  				}else if (ENVIRONMENT_IS_NODE) {
  					config = require(configFilePath);
  				} else { // shell or worker
  					config = JSON.parse(read(configFilePath)); // read is a v8 debugger command
  				}
  				Module.config = config;
  			} catch(e) {
  				Module.config = {message: "failed to load config file", error: e};
  			} finally {
  				Module.removeRunDependency(configFilePath);
  			}
  		},mono_wasm_set_timeout_exec:function(id){
  			if (!this.mono_set_timeout_exec)
  				this.mono_set_timeout_exec = Module.cwrap ("mono_set_timeout_exec", null, [ 'number' ]);
  			this.mono_set_timeout_exec (id);
  		},prevent_timer_throttling:function () {
  			// this will schedule timers every second for next 6 minutes, it should be called from WebSocket event, to make it work
  			// on next call, it would only extend the timers to cover yet uncovered future
  			let now = new Date().valueOf();
  			const desired_reach_time = now + (1000 * 60 * 6);
  			const next_reach_time = Math.max(now + 1000, this.spread_timers_maximum);
  			const light_throttling_frequency = 1000;
  			for (var schedule = next_reach_time; schedule < desired_reach_time; schedule += light_throttling_frequency) {
  				const delay = schedule - now;
  				setTimeout(() => {
  					this.mono_wasm_set_timeout_exec(0);
  					MONO.pump_count++;
  					MONO.pump_message();
  				}, delay);
  			}
  			this.spread_timers_maximum = desired_reach_time;
  		}};
  function _mono_set_timeout(timeout, id) {
  
  		if (typeof globalThis.setTimeout === 'function') {
  			if (MONO.lastScheduleTimeoutId) {
  				globalThis.clearTimeout(MONO.lastScheduleTimeoutId);
  				MONO.lastScheduleTimeoutId = undefined;
  			}
  			MONO.lastScheduleTimeoutId = globalThis.setTimeout(function mono_wasm_set_timeout_exec () {
  				MONO.mono_wasm_set_timeout_exec(id);
  			}, timeout);
  		} else {
  			++MONO.pump_count;
  			MONO.timeout_queue.push(function() {
  				MONO.mono_wasm_set_timeout_exec (id);
  			})
  		}
  	}

  var BINDING={BINDING_ASM:"[System.Private.Runtime.InteropServices.JavaScript]System.Runtime.InteropServices.JavaScript.Runtime",_cs_owned_objects_by_js_handle:[],_js_handle_free_list:[],_next_js_handle:1,mono_wasm_marshal_enum_as_int:true,mono_bindings_init:function (binding_asm) {
  			this.BINDING_ASM = binding_asm;
  		},export_functions:function (module) {
  			module ["mono_bindings_init"] = BINDING.mono_bindings_init.bind(BINDING);
  			module ["mono_bind_method"] = BINDING.bind_method.bind(BINDING);
  			module ["mono_method_invoke"] = BINDING.call_method.bind(BINDING);
  			module ["mono_method_get_call_signature"] = BINDING.mono_method_get_call_signature.bind(BINDING);
  			module ["mono_method_resolve"] = BINDING.resolve_method_fqn.bind(BINDING);
  			module ["mono_bind_static_method"] = BINDING.bind_static_method.bind(BINDING);
  			module ["mono_call_static_method"] = BINDING.call_static_method.bind(BINDING);
  			module ["mono_bind_assembly_entry_point"] = BINDING.bind_assembly_entry_point.bind(BINDING);
  			module ["mono_call_assembly_entry_point"] = BINDING.call_assembly_entry_point.bind(BINDING);
  			module ["mono_intern_string"] = BINDING.mono_intern_string.bind(BINDING);
  		},bindings_lazy_init:function () {
  			if (this.init)
  				return;
  
  			// avoid infinite recursion
  			this.init = true;
  			this.wasm_type_symbol = Symbol.for("wasm type");
  			this.js_owned_gc_handle_symbol = Symbol.for("wasm js_owned_gc_handle");
  			this.cs_owned_js_handle_symbol = Symbol.for("wasm cs_owned_js_handle");
  			this.delegate_invoke_symbol = Symbol.for("wasm delegate_invoke");
  			this.delegate_invoke_signature_symbol = Symbol.for("wasm delegate_invoke_signature");
  			this.listener_registration_count_symbol = Symbol.for("wasm listener_registration_count");
  
  			// please keep System.Runtime.InteropServices.JavaScript.Runtime.MappedType in sync
  			Object.prototype[this.wasm_type_symbol] = 0;
  			Array.prototype[this.wasm_type_symbol] = 1;
  			ArrayBuffer.prototype[this.wasm_type_symbol] = 2;
  			DataView.prototype[this.wasm_type_symbol] = 3;
  			Function.prototype[this.wasm_type_symbol] =  4;
  			Map.prototype[this.wasm_type_symbol] = 5;
  			if (typeof SharedArrayBuffer !== 'undefined')
  				SharedArrayBuffer.prototype[this.wasm_type_symbol] =  6;
  			Int8Array.prototype[this.wasm_type_symbol] = 10;
  			Uint8Array.prototype[this.wasm_type_symbol] = 11;
  			Uint8ClampedArray.prototype[this.wasm_type_symbol] = 12;
  			Int16Array.prototype[this.wasm_type_symbol] = 13;
  			Uint16Array.prototype[this.wasm_type_symbol] = 14;
  			Int32Array.prototype[this.wasm_type_symbol] = 15;
  			Uint32Array.prototype[this.wasm_type_symbol] = 16;
  			Float32Array.prototype[this.wasm_type_symbol] = 17;
  			Float64Array.prototype[this.wasm_type_symbol] = 18;
  
  			this.assembly_load = Module.cwrap ('mono_wasm_assembly_load', 'number', ['string']);
  			this.find_corlib_class = Module.cwrap ('mono_wasm_find_corlib_class', 'number', ['string', 'string']);
  			this.find_class = Module.cwrap ('mono_wasm_assembly_find_class', 'number', ['number', 'string', 'string']);
  			this._find_method = Module.cwrap ('mono_wasm_assembly_find_method', 'number', ['number', 'string', 'number']);
  			this.invoke_method = Module.cwrap ('mono_wasm_invoke_method', 'number', ['number', 'number', 'number', 'number']);
  			this.mono_string_get_utf8 = Module.cwrap ('mono_wasm_string_get_utf8', 'number', ['number']);
  			this.mono_wasm_string_from_utf16 = Module.cwrap ('mono_wasm_string_from_utf16', 'number', ['number', 'number']);
  			this.mono_get_obj_type = Module.cwrap ('mono_wasm_get_obj_type', 'number', ['number']);
  			this.mono_array_length = Module.cwrap ('mono_wasm_array_length', 'number', ['number']);
  			this.mono_array_get = Module.cwrap ('mono_wasm_array_get', 'number', ['number', 'number']);
  			this.mono_obj_array_new = Module.cwrap ('mono_wasm_obj_array_new', 'number', ['number']);
  			this.mono_obj_array_set = Module.cwrap ('mono_wasm_obj_array_set', 'void', ['number', 'number', 'number']);
  			this.mono_wasm_register_bundled_satellite_assemblies = Module.cwrap ('mono_wasm_register_bundled_satellite_assemblies', 'void', [ ]);
  			this.mono_wasm_try_unbox_primitive_and_get_type = Module.cwrap ('mono_wasm_try_unbox_primitive_and_get_type', 'number', ['number', 'number']);
  			this.mono_wasm_box_primitive = Module.cwrap ('mono_wasm_box_primitive', 'number', ['number', 'number', 'number']);
  			this.mono_wasm_intern_string = Module.cwrap ('mono_wasm_intern_string', 'number', ['number']);
  			this.assembly_get_entry_point = Module.cwrap ('mono_wasm_assembly_get_entry_point', 'number', ['number']);
  			this.mono_wasm_get_delegate_invoke = Module.cwrap ('mono_wasm_get_delegate_invoke', 'number', ['number']);
  			this.mono_wasm_string_array_new = Module.cwrap ('mono_wasm_string_array_new', 'number', ['number']);
  
  			this._box_buffer = Module._malloc(16);
  			this._unbox_buffer = Module._malloc(16);
  			this._class_int32 = this.find_corlib_class ("System", "Int32");
  			this._class_uint32 = this.find_corlib_class ("System", "UInt32");
  			this._class_double = this.find_corlib_class ("System", "Double");
  			this._class_boolean = this.find_corlib_class ("System", "Boolean");
  
  			// receives a byteoffset into allocated Heap with a size.
  			this.mono_typed_array_new = Module.cwrap ('mono_wasm_typed_array_new', 'number', ['number','number','number','number']);
  
  			var binding_fqn_asm = this.BINDING_ASM.substring(this.BINDING_ASM.indexOf ("[") + 1, this.BINDING_ASM.indexOf ("]")).trim();
  			var binding_fqn_class = this.BINDING_ASM.substring (this.BINDING_ASM.indexOf ("]") + 1).trim();
  
  			this.binding_module = this.assembly_load (binding_fqn_asm);
  			if (!this.binding_module)
  				throw "Can't find bindings module assembly: " + binding_fqn_asm;
  
  			var namespace = null, classname = null;
  			if (binding_fqn_class !== null && typeof binding_fqn_class !== "undefined")
  			{
  				namespace = "System.Runtime.InteropServices.JavaScript";
  				classname = binding_fqn_class.length > 0 ? binding_fqn_class : "Runtime";
  				if (binding_fqn_class.indexOf(".") != -1) {
  					var idx = binding_fqn_class.lastIndexOf(".");
  					namespace = binding_fqn_class.substring (0, idx);
  					classname = binding_fqn_class.substring (idx + 1);
  				}
  			}
  
  			var wasm_runtime_class = this.find_class (this.binding_module, namespace, classname);
  			if (!wasm_runtime_class)
  				throw "Can't find " + binding_fqn_class + " class";
  
  			var get_method = function(method_name) {
  				var res = BINDING.find_method (wasm_runtime_class, method_name, -1);
  				if (!res)
  					throw "Can't find method " + namespace + "." + classname + ":" + method_name;
  				return res;
  			};
  
  			var bind_runtime_method = function (method_name, signature) {
  				var method = get_method (method_name);
  				return BINDING.bind_method (method, 0, signature, "BINDINGS_" + method_name);
  			};
  
  			this.get_call_sig = get_method ("GetCallSignature");
  
  			// NOTE: The bound methods have a _ prefix on their names to ensure
  			//  that any code relying on the old get_method/call_method pattern will
  			//  break in a more understandable way.
  
  			this._get_cs_owned_object_by_js_handle = bind_runtime_method ("GetCSOwnedObjectByJSHandle", "ii!");
  			this._get_cs_owned_object_js_handle = bind_runtime_method ("GetCSOwnedObjectJSHandle", 'mi');
  			this._try_get_cs_owned_object_js_handle = bind_runtime_method ("TryGetCSOwnedObjectJSHandle", "mi");
  			this._create_cs_owned_proxy = bind_runtime_method ("CreateCSOwnedProxy", "iii!");
  
  			this._get_js_owned_object_by_gc_handle = bind_runtime_method ("GetJSOwnedObjectByGCHandle", "i!");
  			this._get_js_owned_object_gc_handle = bind_runtime_method ("GetJSOwnedObjectGCHandle", "m");
  			this._release_js_owned_object_by_gc_handle = bind_runtime_method ("ReleaseJSOwnedObjectByGCHandle", "i");
  
  			this._create_tcs = bind_runtime_method ("CreateTaskSource","");
  			this._set_tcs_result = bind_runtime_method ("SetTaskSourceResult","io");
  			this._set_tcs_failure = bind_runtime_method ("SetTaskSourceFailure","is");
  			this._get_tcs_task = bind_runtime_method ("GetTaskSourceTask","i!");
  			this._setup_js_cont = bind_runtime_method ("SetupJSContinuation", "mo");
  			
  			this._object_to_string = bind_runtime_method ("ObjectToString", "m");
  			this._get_date_value = bind_runtime_method ("GetDateValue", "m");
  			this._create_date_time = bind_runtime_method ("CreateDateTime", "d!");
  			this._create_uri = bind_runtime_method ("CreateUri","s!");
  			this._is_simple_array = bind_runtime_method ("IsSimpleArray", "m");
  
  			this._are_promises_supported = ((typeof Promise === "object") || (typeof Promise === "function")) && (typeof Promise.resolve === "function");
  			this.isThenable = (js_obj) => {
  				// When using an external Promise library like Bluebird the Promise.resolve may not be sufficient
  				// to identify the object as a Promise.
  				return Promise.resolve(js_obj) === js_obj ||
  						((typeof js_obj === "object" || typeof js_obj === "function") && typeof js_obj.then === "function")
  			};
  			this.isChromium = false;
  			if (globalThis.navigator) {
  				var nav = globalThis.navigator;
  				if (nav.userAgentData && nav.userAgentData.brands) {
  					this.isChromium = nav.userAgentData.brands.some((i) => i.brand == 'Chromium');
  				}
  				else if (globalThis.navigator.userAgent) {
  					this.isChromium = nav.userAgent.includes("Chrome");
  				}
  			}
  
  			this._empty_string = "";
  			this._empty_string_ptr = 0;
  			this._interned_string_full_root_buffers = [];
  			this._interned_string_current_root_buffer = null;
  			this._interned_string_current_root_buffer_count = 0;
  			this._interned_js_string_table = new Map ();
  
  			this._js_owned_object_table = new Map ();
  			// NOTE: FinalizationRegistry and WeakRef are missing on Safari below 14.1
  			this._use_finalization_registry = typeof globalThis.FinalizationRegistry === "function";
  			this._use_weak_ref = typeof globalThis.WeakRef === "function";
  
  			if (this._use_finalization_registry) {
  				this._js_owned_object_registry = new globalThis.FinalizationRegistry(this._js_owned_object_finalized.bind(this));
  			}
  		},_js_owned_object_finalized:function (gc_handle) {
  			// The JS object associated with this gc_handle has been collected by the JS GC.
  			// As such, it's not possible for this gc_handle to be invoked by JS anymore, so
  			//  we can release the tracking weakref (it's null now, by definition),
  			//  and tell the C# side to stop holding a reference to the managed object.
  			this._js_owned_object_table.delete(gc_handle);
  			this._release_js_owned_object_by_gc_handle(gc_handle);
  		},_lookup_js_owned_object:function (gc_handle) {
  			if (!gc_handle)
  				return null;
  			var wr = this._js_owned_object_table.get(gc_handle);
  			if (wr) {
  				return wr.deref();
  				// TODO: could this be null before _js_owned_object_finalized was called ?
  				// TODO: are there race condition consequences ?
  			}
  			return null;
  		},_register_js_owned_object:function (gc_handle, js_obj) {
  			var wr;
  			if (this._use_weak_ref) {
  				wr = new WeakRef(js_obj);
  			}
  			else {
  				// this is trivial WeakRef replacement, which holds strong refrence, instead of weak one, when the browser doesn't support it
  				wr = {
  					deref: () => {
  						return js_obj;
  					}
  				}
  			}
  
  			this._js_owned_object_table.set(gc_handle, wr);
  		},_wrap_js_thenable_as_task:function (thenable) {
  			this.bindings_lazy_init ();
  			if (!thenable)
  				return null;
  
  			// hold strong JS reference to thenable while in flight
  			// ideally, this should be hold alive by lifespan of the resulting C# Task, but this is good cheap aproximation
  			var thenable_js_handle = BINDING.mono_wasm_get_js_handle(thenable);
  
  			// Note that we do not implement promise/task roundtrip. 
  			// With more complexity we could recover original instance when this Task is marshaled back to JS.
  			// TODO optimization: return the tcs.Task on this same call instead of _get_tcs_task
  			const tcs_gc_handle = this._create_tcs();
  			thenable.then ((result) => {
  				this._set_tcs_result(tcs_gc_handle, result);
  				// let go of the thenable reference
  				this._mono_wasm_release_js_handle(thenable_js_handle);
  
  				// when FinalizationRegistry is not supported by this browser, we will do immediate cleanup after use
  				if (!this._use_finalization_registry) {
  					this._release_js_owned_object_by_gc_handle(tcs_gc_handle);
  				}
  			}, (reason) => {
  				this._set_tcs_failure(tcs_gc_handle, reason ? reason.toString() : "");
  				// let go of the thenable reference
  				this._mono_wasm_release_js_handle(thenable_js_handle);
  
  				// when FinalizationRegistry is not supported by this browser, we will do immediate cleanup after use
  				if (!this._use_finalization_registry) {
  					this._release_js_owned_object_by_gc_handle(tcs_gc_handle);
  				}
  			});
  
  			// collect the TaskCompletionSource with its Task after js doesn't hold the thenable anymore
  			if (this._use_finalization_registry) {
  				this._js_owned_object_registry.register(thenable, tcs_gc_handle);
  			}
  
  			// returns raw pointer to tcs.Task
  			return this._get_tcs_task(tcs_gc_handle);
  		},_unbox_task_root_as_promise:function (root) {
  			this.bindings_lazy_init ();
  			const self = this;
  			if (root.value === 0)
  				return null;
  
  			if (!this._are_promises_supported)
  				throw new Error ("Promises are not supported thus 'System.Threading.Tasks.Task' can not work in this context.");
  
  			// get strong reference to Task
  			const gc_handle = this._get_js_owned_object_gc_handle(root.value);
  
  			// see if we have js owned instance for this gc_handle already
  			var result = this._lookup_js_owned_object(gc_handle);
  
  			// If the promise for this gc_handle was already collected (or was never created)
  			if (!result) {
  
  				var cont_obj = null;
  				// note that we do not implement promise/task roundtrip
  				// With more complexity we could recover original instance when this promise is marshaled back to C#.
  				var result = new Promise(function (resolve, reject) {
  					if (self._use_finalization_registry) {
  						cont_obj = {
  							resolve: resolve,
  							reject: reject
  						};
  					} else {
  						// when FinalizationRegistry is not supported by this browser, we will do immediate cleanup after use
  						cont_obj = {
  							resolve: function () {
  								const res = resolve.apply(null, arguments);
  								self._js_owned_object_table.delete(gc_handle);
  								self._release_js_owned_object_by_gc_handle(gc_handle);
  								return res;
  							},
  							reject: function () {
  								const res = reject.apply(null, arguments);
  								self._js_owned_object_table.delete(gc_handle);
  								self._release_js_owned_object_by_gc_handle(gc_handle);
  								return res;
  							}
  						};
  					}
  				});
  
  				// register C# side of the continuation
  				this._setup_js_cont (root.value, cont_obj );
  				
  				// register for GC of the Task after the JS side is done with the promise
  				if (this._use_finalization_registry) {
  					this._js_owned_object_registry.register(result, gc_handle);
  				}
  
  				// register for instance reuse
  				this._register_js_owned_object(gc_handle, result);
  			}
  
  			return result;
  		},_unbox_ref_type_root_as_js_object:function (root) {
  			this.bindings_lazy_init ();
  			if (root.value === 0)
  				return null;
  
  			// this could be JSObject proxy of a js native object
  			// we don't need in-flight reference as we already have it rooted here
  			var js_handle = this._try_get_cs_owned_object_js_handle (root.value, false);
  			if (js_handle) {
  				if (js_handle===-1){
  					throw new Error("Cannot access a disposed JSObject at " + root.value);
  				}
  				return this.mono_wasm_get_jsobj_from_js_handle(js_handle);
  			}
  			// otherwise this is C# only object
  	
  			// get strong reference to Object
  			const gc_handle = this._get_js_owned_object_gc_handle(root.value);
  
  			// see if we have js owned instance for this gc_handle already
  			var result = this._lookup_js_owned_object(gc_handle);
  
  			// If the JS object for this gc_handle was already collected (or was never created)
  			if (!result) {
  				result = {};
  
  				// keep the gc_handle so that we could easily convert it back to original C# object for roundtrip
  				result[BINDING.js_owned_gc_handle_symbol]=gc_handle;
  
  				// NOTE: this would be leaking C# objects when the browser doesn't support FinalizationRegistry/WeakRef
  				if (this._use_finalization_registry) {
  					// register for GC of the C# object after the JS side is done with the object
  					this._js_owned_object_registry.register(result, gc_handle);
  				}
  
  				// register for instance reuse
  				// NOTE: this would be leaking C# objects when the browser doesn't support FinalizationRegistry/WeakRef
  				this._register_js_owned_object(gc_handle, result);
  			}
  
  			return result;
  		},_wrap_delegate_root_as_function:function (root) {
  			this.bindings_lazy_init ();
  			if (root.value === 0)
  				return null;
  
  			// get strong reference to the Delegate
  			const gc_handle = this._get_js_owned_object_gc_handle(root.value);
  			return this._wrap_delegate_gc_handle_as_function(gc_handle);
  		},_wrap_delegate_gc_handle_as_function:function (gc_handle, after_listener_callback) {
  			this.bindings_lazy_init ();
  
  			// see if we have js owned instance for this gc_handle already
  			var result = this._lookup_js_owned_object(gc_handle);
  
  			// If the function for this gc_handle was already collected (or was never created)
  			if (!result) {
  				// note that we do not implement function/delegate roundtrip
  				result = function() {
  					const delegateRoot = MONO.mono_wasm_new_root (BINDING.get_js_owned_object_by_gc_handle(gc_handle));
  					try {
  						const res = BINDING.call_method(result[BINDING.delegate_invoke_symbol], delegateRoot.value, result[BINDING.delegate_invoke_signature_symbol], arguments);
  						if (after_listener_callback) { 
  							after_listener_callback(); 
  						}
  						return res;
  					} finally {
  						delegateRoot.release();
  					}
  				};
  
  				// bind the method
  				const delegateRoot = MONO.mono_wasm_new_root (BINDING.get_js_owned_object_by_gc_handle(gc_handle));
  				try {
  					if (typeof result[BINDING.delegate_invoke_symbol] === "undefined"){
  						result[BINDING.delegate_invoke_symbol] = BINDING.mono_wasm_get_delegate_invoke(delegateRoot.value);
  						if (!result[BINDING.delegate_invoke_symbol]){
  							throw new Error("System.Delegate Invoke method can not be resolved.");
  						}
  					}
  
  					if (typeof result[BINDING.delegate_invoke_signature_symbol] === "undefined"){
  						result[BINDING.delegate_invoke_signature_symbol] = Module.mono_method_get_call_signature (result[BINDING.delegate_invoke_symbol], delegateRoot.value);
  					}
  				} finally {
  					delegateRoot.release();
  				}
  
  				// NOTE: this would be leaking C# objects when the browser doesn't support FinalizationRegistry. Except in case of EventListener where we cleanup after unregistration.
  				if (this._use_finalization_registry) {
  					// register for GC of the deleate after the JS side is done with the function
  					this._js_owned_object_registry.register(result, gc_handle);
  				}
  
  				// register for instance reuse
  				// NOTE: this would be leaking C# objects when the browser doesn't support FinalizationRegistry/WeakRef. Except in case of EventListener where we cleanup after unregistration.
  				this._register_js_owned_object(gc_handle, result);
  			}
  
  			return result;
  		},mono_intern_string:function (string) {
  			if (string.length === 0)
  				return this._empty_string;
  
  			var ptr = this.js_string_to_mono_string_interned (string);
  			var result = MONO.interned_string_table.get (ptr);
  			return result;
  		},_store_string_in_intern_table:function (string, ptr, internIt) {
  			if (!ptr)
  				throw new Error ("null pointer passed to _store_string_in_intern_table");
  			else if (typeof (ptr) !== "number")
  				throw new Error (`non-pointer passed to _store_string_in_intern_table: ${typeof(ptr)}`);
  			
  			const internBufferSize = 8192;
  
  			if (this._interned_string_current_root_buffer_count >= internBufferSize) {
  				this._interned_string_full_root_buffers.push (this._interned_string_current_root_buffer);
  				this._interned_string_current_root_buffer = null;
  			}
  			if (!this._interned_string_current_root_buffer) {
  				this._interned_string_current_root_buffer = MONO.mono_wasm_new_root_buffer (internBufferSize, "interned strings");
  				this._interned_string_current_root_buffer_count = 0;
  			}
  
  			var rootBuffer = this._interned_string_current_root_buffer;
  			var index = this._interned_string_current_root_buffer_count++;
  			rootBuffer.set (index, ptr);
  
  			// Store the managed string into the managed intern table. This can theoretically
  			//  provide a different managed object than the one we passed in, so update our
  			//  pointer (stored in the root) with the result.
  			if (internIt)
  				rootBuffer.set (index, ptr = this.mono_wasm_intern_string (ptr));
  
  			if (!ptr)
  				throw new Error ("mono_wasm_intern_string produced a null pointer");
  
  			this._interned_js_string_table.set (string, ptr);
  			if (!MONO.interned_string_table)
  				MONO.interned_string_table = new Map();
  			MONO.interned_string_table.set (ptr, string);
  
  			if ((string.length === 0) && !this._empty_string_ptr)
  				this._empty_string_ptr = ptr;
  			
  			return ptr;
  		},js_string_to_mono_string_interned:function (string) {
  			var text = (typeof (string) === "symbol")
  				? (string.description || Symbol.keyFor(string) || "<unknown Symbol>")
  				: string;
  			
  			if ((text.length === 0) && this._empty_string_ptr)
  				return this._empty_string_ptr;
  
  			var ptr = this._interned_js_string_table.get (string);
  			if (ptr)
  				return ptr;
  
  			ptr = this.js_string_to_mono_string_new (text);
  			ptr = this._store_string_in_intern_table (string, ptr, true);
  
  			return ptr;
  		},js_string_to_mono_string:function (string) {
  			if (string === null)
  				return null;
  			else if (typeof (string) === "symbol")
  				return this.js_string_to_mono_string_interned (string);
  			else if (typeof (string) !== "string")
  				throw new Error ("Expected string argument, got "+ typeof (string));
  
  			// Always use an interned pointer for empty strings
  			if (string.length === 0)
  				return this.js_string_to_mono_string_interned (string);
  
  			// Looking up large strings in the intern table will require the JS runtime to
  			//  potentially hash them and then do full byte-by-byte comparisons, which is
  			//  very expensive. Because we can not guarantee it won't happen, try to minimize
  			//  the cost of this and prevent performance issues for large strings
  			if (string.length <= 256) {
  				var interned = this._interned_js_string_table.get (string);
  				if (interned)
  					return interned;
  			}
  
  			return this.js_string_to_mono_string_new (string);
  		},js_string_to_mono_string_new:function (string) {
  			var buffer = Module._malloc ((string.length + 1) * 2);
  			var buffer16 = (buffer / 2) | 0;
  			for (var i = 0; i < string.length; i++)
  				Module.HEAP16[buffer16 + i] = string.charCodeAt (i);
  			Module.HEAP16[buffer16 + string.length] = 0;
  			var result = this.mono_wasm_string_from_utf16 (buffer, string.length);
  			Module._free (buffer);
  			return result;
  		},find_method:function (klass, name, n) {
  			var result = this._find_method(klass, name, n);
  			if (result) {
  				if (!this._method_descriptions)
  					this._method_descriptions = new Map();
  				this._method_descriptions.set(result, name);
  			}
  			return result;
  		},get_js_obj:function (js_handle) {
  			if (js_handle > 0)
  				return this.mono_wasm_get_jsobj_from_js_handle(js_handle);
  			return null;
  		},_get_string_from_intern_table:function (mono_obj) {
  			if (!MONO.interned_string_table)
  				return undefined;
  			return MONO.interned_string_table.get (mono_obj);
  		},conv_string:function (mono_obj) {
  			return MONO.string_decoder.copy (mono_obj);
  		},is_nested_array:function (ele) {
  			return this._is_simple_array(ele);
  		},mono_array_to_js_array:function (mono_array) {
  			if (mono_array === 0)
  				return null;
  
  			var arrayRoot = MONO.mono_wasm_new_root (mono_array);
  			try {
  				return this._mono_array_root_to_js_array (arrayRoot);
  			} finally {
  				arrayRoot.release();
  			}
  		},_mono_array_root_to_js_array:function (arrayRoot) {
  			if (arrayRoot.value === 0)
  				return null;
  
  			let elemRoot = MONO.mono_wasm_new_root ();
  
  			try {
  				var len = this.mono_array_length (arrayRoot.value);
  				var res = new Array (len);
  				for (var i = 0; i < len; ++i)
  				{
  					elemRoot.value = this.mono_array_get (arrayRoot.value, i);
  
  					if (this.is_nested_array (elemRoot.value))
  						res[i] = this._mono_array_root_to_js_array (elemRoot);
  					else
  						res[i] = this._unbox_mono_obj_root (elemRoot);
  				}
  			} finally {
  				elemRoot.release ();
  			}
  
  			return res;
  		},js_array_to_mono_array:function (js_array, asString, should_add_in_flight) {
  			var mono_array = asString ? this.mono_wasm_string_array_new (js_array.length) : this.mono_obj_array_new (js_array.length);
  			let [arrayRoot, elemRoot] = MONO.mono_wasm_new_roots ([mono_array, 0]);
  
  			try {
  				for (var i = 0; i < js_array.length; ++i) {
  					var obj = js_array[i];
  					if (asString)
  						obj = obj.toString ();
  
  					elemRoot.value = this._js_to_mono_obj (should_add_in_flight, obj);
  					this.mono_obj_array_set (arrayRoot.value, i, elemRoot.value);
  				}
  
  				return mono_array;
  			} finally {
  				MONO.mono_wasm_release_roots (arrayRoot, elemRoot);
  			}
  		},js_to_mono_obj:function (js_obj) {
  			return this._js_to_mono_obj(false, js_obj)
  		},unbox_mono_obj:function (mono_obj) {
  			if (mono_obj === 0)
  				return undefined;
  
  			var root = MONO.mono_wasm_new_root (mono_obj);
  			try {
  				return this._unbox_mono_obj_root (root);
  			} finally {
  				root.release();
  			}
  		},_unbox_cs_owned_root_as_js_object:function (root) {
  			// we don't need in-flight reference as we already have it rooted here
  			var js_handle = this._get_cs_owned_object_js_handle(root.value, false);
  			var js_obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  			return js_obj;
  		},_unbox_mono_obj_root_with_known_nonprimitive_type:function (root, type) {
  			if (root.value === undefined)
  				throw new Error(`Expected a root but got ${root}`);
  			
  			//See MARSHAL_TYPE_ defines in driver.c
  			switch (type) {
  				case 26: // int64
  				case 27: // uint64
  					// TODO: Fix this once emscripten offers HEAPI64/HEAPU64 or can return them
  					throw new Error ("int64 not available");
  				case 3: // string
  				case 29: // interned string
  					return this.conv_string (root.value);
  				case 4: //vts
  					throw new Error ("no idea on how to unbox value types");
  				case 5: // delegate
  					return this._wrap_delegate_root_as_function (root);
  				case 6: // Task
  					return this._unbox_task_root_as_promise (root);
  				case 7: // ref type
  					return this._unbox_ref_type_root_as_js_object (root);
  				case 10: // arrays
  				case 11:
  				case 12:
  				case 13:
  				case 14:
  				case 15:
  				case 16:
  				case 17:
  				case 18:
  					throw new Error ("Marshalling of primitive arrays are not supported.  Use the corresponding TypedArray instead.");
  				case 20: // clr .NET DateTime
  					var dateValue = this._get_date_value(root.value);
  					return new Date(dateValue);
  				case 21: // clr .NET DateTimeOffset
  					var dateoffsetValue = this._object_to_string (root.value);
  					return dateoffsetValue;
  				case 22: // clr .NET Uri
  					var uriValue = this._object_to_string (root.value);
  					return uriValue;
  				case 23: // clr .NET SafeHandle/JSObject
  					return this._unbox_cs_owned_root_as_js_object (root);
  				case 30:
  					return undefined;
  				default:
  					throw new Error (`no idea on how to unbox object kind ${type} at offset ${root.value} (root address is ${root.get_address()})`);
  			}
  		},_unbox_mono_obj_root:function (root) {
  			if (root.value === 0)
  				return undefined;
  
  			var type = this.mono_wasm_try_unbox_primitive_and_get_type (root.value, this._unbox_buffer);
  			switch (type) {
  				case 1: // int
  					return Module.HEAP32[this._unbox_buffer / 4];
  				case 25: // uint32
  					return Module.HEAPU32[this._unbox_buffer / 4];
  				case 24: // float32
  					return Module.HEAPF32[this._unbox_buffer / 4];
  				case 2: // float64
  					return Module.HEAPF64[this._unbox_buffer / 8];
  				case 8: // boolean
  					return (Module.HEAP32[this._unbox_buffer / 4]) !== 0;
  				case 28: // char
  					return String.fromCharCode(Module.HEAP32[this._unbox_buffer / 4]);
  				default:
  					return this._unbox_mono_obj_root_with_known_nonprimitive_type (root, type);
  			}
  		},js_typedarray_to_heap:function(typedArray){
  			var numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
  			var ptr = Module._malloc(numBytes);
  			var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
  			heapBytes.set(new Uint8Array(typedArray.buffer, typedArray.byteOffset, numBytes));
  			return heapBytes;
  		},_box_js_int:function (js_obj) {
  			Module.HEAP32[this._box_buffer / 4] = js_obj;
  			return this.mono_wasm_box_primitive (this._class_int32, this._box_buffer, 4);
  		},_box_js_uint:function (js_obj) {
  			Module.HEAPU32[this._box_buffer / 4] = js_obj;
  			return this.mono_wasm_box_primitive (this._class_uint32, this._box_buffer, 4);
  		},_box_js_double:function (js_obj) {
  			Module.HEAPF64[this._box_buffer / 8] = js_obj;
  			return this.mono_wasm_box_primitive (this._class_double, this._box_buffer, 8);
  		},_box_js_bool:function (js_obj) {
  			Module.HEAP32[this._box_buffer / 4] = js_obj ? 1 : 0;
  			return this.mono_wasm_box_primitive (this._class_boolean, this._box_buffer, 4);
  		},_js_to_mono_uri:function (should_add_in_flight, js_obj) {
  			this.bindings_lazy_init ();
  
  			switch (true) {
  				case js_obj === null:
  				case typeof js_obj === "undefined":
  					return 0;
  				case typeof js_obj === "symbol":
  				case typeof js_obj === "string":
  					return this._create_uri(js_obj)
  				default:
  					return this._extract_mono_obj (should_add_in_flight, js_obj);
  			}
  		},_js_to_mono_obj:function (should_add_in_flight, js_obj) {
  			this.bindings_lazy_init ();
  
  			switch (true) {
  				case js_obj === null:
  				case typeof js_obj === "undefined":
  					return 0;
  				case typeof js_obj === "number": {
  					if ((js_obj | 0) === js_obj)
  						result = this._box_js_int (js_obj);
  					else if ((js_obj >>> 0) === js_obj)
  						result = this._box_js_uint (js_obj);
  					else
  						result = this._box_js_double (js_obj);
  
  					if (!result)
  						throw new Error (`Boxing failed for ${js_obj}`);
  
  					return result;
  				} case typeof js_obj === "string":
  					return this.js_string_to_mono_string (js_obj);
  				case typeof js_obj === "symbol":
  					return this.js_string_to_mono_string_interned (js_obj);
  				case typeof js_obj === "boolean":
  					return this._box_js_bool (js_obj);
  				case this.isThenable(js_obj) === true:
  					return this._wrap_js_thenable_as_task (js_obj);
  				case js_obj.constructor.name === "Date":
  					// getTime() is always UTC
  					return this._create_date_time(js_obj.getTime());
  				default:
  					return this._extract_mono_obj (should_add_in_flight, js_obj);
  			}
  		},_extract_mono_obj:function (should_add_in_flight, js_obj) {
  			if (js_obj === null || typeof js_obj === "undefined")
  				return 0;
  
  			var result = null;
  			if (js_obj[BINDING.js_owned_gc_handle_symbol]) {
  				// for js_owned_gc_handle we don't want to create new proxy
  				// since this is strong gc_handle we don't need to in-flight reference
  				result = this.get_js_owned_object_by_gc_handle (js_obj[BINDING.js_owned_gc_handle_symbol]);
  				return result;
  			}
  			if (js_obj[BINDING.cs_owned_js_handle_symbol]) {
  				result = this.get_cs_owned_object_by_js_handle (js_obj[BINDING.cs_owned_js_handle_symbol], should_add_in_flight);
  
  				// It's possible the managed object corresponding to this JS object was collected,
  				//  in which case we need to make a new one.
  				if (!result) {
  					delete js_obj[BINDING.cs_owned_js_handle_symbol];
  				}
  			}
  
  			if (!result) {
  				// Obtain the JS -> C# type mapping.
  				const wasm_type = js_obj[this.wasm_type_symbol];
  				const wasm_type_id = typeof wasm_type === "undefined" ? 0 : wasm_type;
  
  				var js_handle = BINDING.mono_wasm_get_js_handle(js_obj);
  
  				result = this._create_cs_owned_proxy(js_handle, wasm_type_id, should_add_in_flight);
  			}
  
  			return result;
  		},has_backing_array_buffer:function (js_obj) {
  			return typeof SharedArrayBuffer !== 'undefined'
  				? js_obj.buffer instanceof ArrayBuffer || js_obj.buffer instanceof SharedArrayBuffer
  				: js_obj.buffer instanceof ArrayBuffer;
  		},js_typed_array_to_array:function (js_obj) {
  
  			// JavaScript typed arrays are array-like objects and provide a mechanism for accessing
  			// raw binary data. (...) To achieve maximum flexibility and efficiency, JavaScript typed arrays
  			// split the implementation into buffers and views. A buffer (implemented by the ArrayBuffer object)
  			//  is an object representing a chunk of data; it has no format to speak of, and offers no
  			// mechanism for accessing its contents. In order to access the memory contained in a buffer,
  			// you need to use a view. A view provides a context — that is, a data type, starting offset,
  			// and number of elements — that turns the data into an actual typed array.
  			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
  			if (!!(this.has_backing_array_buffer(js_obj) && js_obj.BYTES_PER_ELEMENT))
  			{
  				var arrayType = js_obj[this.wasm_type_symbol];
  				var heapBytes = this.js_typedarray_to_heap(js_obj);
  				var bufferArray = this.mono_typed_array_new(heapBytes.byteOffset, js_obj.length, js_obj.BYTES_PER_ELEMENT, arrayType);
  				Module._free(heapBytes.byteOffset);
  				return bufferArray;
  			}
  			else {
  				throw new Error("Object '" + js_obj + "' is not a typed array");
  			}
  
  		},typedarray_copy_to:function (typed_array, pinned_array, begin, end, bytes_per_element) {
  
  			// JavaScript typed arrays are array-like objects and provide a mechanism for accessing
  			// raw binary data. (...) To achieve maximum flexibility and efficiency, JavaScript typed arrays
  			// split the implementation into buffers and views. A buffer (implemented by the ArrayBuffer object)
  			//  is an object representing a chunk of data; it has no format to speak of, and offers no
  			// mechanism for accessing its contents. In order to access the memory contained in a buffer,
  			// you need to use a view. A view provides a context — that is, a data type, starting offset,
  			// and number of elements — that turns the data into an actual typed array.
  			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
  			if (!!(this.has_backing_array_buffer(typed_array) && typed_array.BYTES_PER_ELEMENT))
  			{
  				// Some sanity checks of what is being asked of us
  				// lets play it safe and throw an error here instead of assuming to much.
  				// Better safe than sorry later
  				if (bytes_per_element !== typed_array.BYTES_PER_ELEMENT)
  					throw new Error("Inconsistent element sizes: TypedArray.BYTES_PER_ELEMENT '" + typed_array.BYTES_PER_ELEMENT + "' sizeof managed element: '" + bytes_per_element + "'");
  
  				// how much space we have to work with
  				var num_of_bytes = (end - begin) * bytes_per_element;
  				// how much typed buffer space are we talking about
  				var view_bytes = typed_array.length * typed_array.BYTES_PER_ELEMENT;
  				// only use what is needed.
  				if (num_of_bytes > view_bytes)
  					num_of_bytes = view_bytes;
  
  				// offset index into the view
  				var offset = begin * bytes_per_element;
  
  				// Create a view over the heap pointed to by the pinned array address
  				var heapBytes = new Uint8Array(Module.HEAPU8.buffer, pinned_array + offset, num_of_bytes);
  				// Copy the bytes of the typed array to the heap.
  				heapBytes.set(new Uint8Array(typed_array.buffer, typed_array.byteOffset, num_of_bytes));
  
  				return num_of_bytes;
  			}
  			else {
  				throw new Error("Object '" + typed_array + "' is not a typed array");
  			}
  
  		},typedarray_copy_from:function (typed_array, pinned_array, begin, end, bytes_per_element) {
  
  			// JavaScript typed arrays are array-like objects and provide a mechanism for accessing
  			// raw binary data. (...) To achieve maximum flexibility and efficiency, JavaScript typed arrays
  			// split the implementation into buffers and views. A buffer (implemented by the ArrayBuffer object)
  			//  is an object representing a chunk of data; it has no format to speak of, and offers no
  			// mechanism for accessing its contents. In order to access the memory contained in a buffer,
  			// you need to use a view. A view provides a context — that is, a data type, starting offset,
  			// and number of elements — that turns the data into an actual typed array.
  			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays
  			if (!!(this.has_backing_array_buffer(typed_array) && typed_array.BYTES_PER_ELEMENT))
  			{
  				// Some sanity checks of what is being asked of us
  				// lets play it safe and throw an error here instead of assuming to much.
  				// Better safe than sorry later
  				if (bytes_per_element !== typed_array.BYTES_PER_ELEMENT)
  					throw new Error("Inconsistent element sizes: TypedArray.BYTES_PER_ELEMENT '" + typed_array.BYTES_PER_ELEMENT + "' sizeof managed element: '" + bytes_per_element + "'");
  
  				// how much space we have to work with
  				var num_of_bytes = (end - begin) * bytes_per_element;
  				// how much typed buffer space are we talking about
  				var view_bytes = typed_array.length * typed_array.BYTES_PER_ELEMENT;
  				// only use what is needed.
  				if (num_of_bytes > view_bytes)
  					num_of_bytes = view_bytes;
  
  				// Create a new view for mapping
  				var typedarrayBytes = new Uint8Array(typed_array.buffer, 0, num_of_bytes);
  				// offset index into the view
  				var offset = begin * bytes_per_element;
  				// Set view bytes to value from HEAPU8
  				typedarrayBytes.set(Module.HEAPU8.subarray(pinned_array + offset, pinned_array + offset + num_of_bytes));
  				return num_of_bytes;
  			}
  			else {
  				throw new Error("Object '" + typed_array + "' is not a typed array");
  			}
  
  		},typed_array_from:function (pinned_array, begin, end, bytes_per_element, type) {
  
  			// typed array
  			var newTypedArray = 0;
  
  			switch (type)
  			{
  				case 5:
  					newTypedArray = new Int8Array(end - begin);
  					break;
  				case 6:
  					newTypedArray = new Uint8Array(end - begin);
  					break;
  				case 7:
  					newTypedArray = new Int16Array(end - begin);
  					break;
  				case 8:
  					newTypedArray = new Uint16Array(end - begin);
  					break;
  				case 9:
  					newTypedArray = new Int32Array(end - begin);
  					break;
  				case 10:
  					newTypedArray = new Uint32Array(end - begin);
  					break;
  				case 13:
  					newTypedArray = new Float32Array(end - begin);
  					break;
  				case 14:
  					newTypedArray = new Float64Array(end - begin);
  					break;
  				case 15:  // This is a special case because the typed array is also byte[]
  					newTypedArray = new Uint8ClampedArray(end - begin);
  					break;
  			}
  
  			this.typedarray_copy_from(newTypedArray, pinned_array, begin, end, bytes_per_element);
  			return newTypedArray;
  		},js_to_mono_enum:function (js_obj, method, parmIdx) {
  			this.bindings_lazy_init ();
  
  			if (typeof (js_obj) !== "number")
  				throw new Error (`Expected numeric value for enum argument, got '${js_obj}'`);
  
  			return js_obj | 0;
  		},get_js_owned_object_by_gc_handle:function (gc_handle)
  		{
  			if(!gc_handle){
  				return 0;
  			}
  			// this is always strong gc_handle
  			return this._get_js_owned_object_by_gc_handle (gc_handle);
  		},get_cs_owned_object_by_js_handle:function (js_handle, should_add_in_flight)
  		{
  			if(!js_handle){
  				return 0;
  			}
  			return this._get_cs_owned_object_by_js_handle (js_handle, should_add_in_flight);
  		},mono_method_get_call_signature:function(method, mono_obj) {
  			let instanceRoot = MONO.mono_wasm_new_root (mono_obj);
  			try {
  				this.bindings_lazy_init ();
  
  				return this.call_method (this.get_call_sig, null, "im", [ method, instanceRoot.value ]);
  			} finally {
  				instanceRoot.release();
  			}
  		},_create_named_function:function (name, argumentNames, body, closure) {
  			var result = null, keys = null, closureArgumentList = null, closureArgumentNames = null;
  
  			if (closure) {
  				closureArgumentNames = Object.keys (closure);
  				closureArgumentList = new Array (closureArgumentNames.length);
  				for (var i = 0, l = closureArgumentNames.length; i < l; i++)
  					closureArgumentList[i] = closure[closureArgumentNames[i]];
  			}
  
  			var constructor = this._create_rebindable_named_function (name, argumentNames, body, closureArgumentNames);
  			result = constructor.apply (null, closureArgumentList);
  
  			return result;
  		},_create_rebindable_named_function:function (name, argumentNames, body, closureArgNames) {
  			var strictPrefix = "\"use strict\";\r\n";
  			var uriPrefix = "", escapedFunctionIdentifier = "";
  
  			if (name) {
  				uriPrefix = "//# sourceURL=https://mono-wasm.invalid/" + name + "\r\n";
  				escapedFunctionIdentifier = name;
  			} else {
  				escapedFunctionIdentifier = "unnamed";
  			}
  
  			var rawFunctionText = "function " + escapedFunctionIdentifier + "(" +
  				argumentNames.join(", ") +
  				") {\r\n" +
  				body +
  				"\r\n};\r\n";
  
  			var lineBreakRE = /\r(\n?)/g;
  
  			rawFunctionText =
  				uriPrefix + strictPrefix +
  				rawFunctionText.replace(lineBreakRE, "\r\n    ") +
  				`    return ${escapedFunctionIdentifier};\r\n`;
  
  			var result = null, keys = null;
  
  			if (closureArgNames) {
  				keys = closureArgNames.concat ([rawFunctionText]);
  			} else {
  				keys = [rawFunctionText];
  			}
  
  			result = Function.apply (Function, keys);
  			return result;
  		},_create_primitive_converters:function () {
  			var result = new Map ();
  			result.set ('m', { steps: [{ }], size: 0});
  			result.set ('s', { steps: [{ convert: this.js_string_to_mono_string.bind (this) }], size: 0, needs_root: true });
  			result.set ('S', { steps: [{ convert: this.js_string_to_mono_string_interned.bind (this) }], size: 0, needs_root: true });
  			// note we also bind first argument to false for both _js_to_mono_obj and _js_to_mono_uri, 
  			// because we will root the reference, so we don't need in-flight reference
  			// also as those are callback arguments and we don't have platform code which would release the in-flight reference on C# end
  			result.set ('o', { steps: [{ convert: this._js_to_mono_obj.bind (this, false) }], size: 0, needs_root: true });
  			result.set ('u', { steps: [{ convert: this._js_to_mono_uri.bind (this, false) }], size: 0, needs_root: true });
  
  			// result.set ('k', { steps: [{ convert: this.js_to_mono_enum.bind (this), indirect: 'i64'}], size: 8});
  			result.set ('j', { steps: [{ convert: this.js_to_mono_enum.bind (this), indirect: 'i32'}], size: 8});
  
  			result.set ('i', { steps: [{ indirect: 'i32'}], size: 8});
  			result.set ('l', { steps: [{ indirect: 'i64'}], size: 8});
  			result.set ('f', { steps: [{ indirect: 'float'}], size: 8});
  			result.set ('d', { steps: [{ indirect: 'double'}], size: 8});
  
  			this._primitive_converters = result;
  			return result;
  		},_create_converter_for_marshal_string:function (args_marshal) {
  			var primitiveConverters = this._primitive_converters;
  			if (!primitiveConverters)
  				primitiveConverters = this._create_primitive_converters ();
  
  			var steps = [];
  			var size = 0;
  			var is_result_definitely_unmarshaled = false,
  				is_result_possibly_unmarshaled = false,
  				result_unmarshaled_if_argc = -1,
  				needs_root_buffer = false;
  
  			for (var i = 0; i < args_marshal.length; ++i) {
  				var key = args_marshal[i];
  
  				if (i === args_marshal.length - 1) {
  					if (key === "!") {
  						is_result_definitely_unmarshaled = true;
  						continue;
  					} else if (key === "m") {
  						is_result_possibly_unmarshaled = true;
  						result_unmarshaled_if_argc = args_marshal.length - 1;
  					}
  				} else if (key === "!")
  					throw new Error ("! must be at the end of the signature");
  
  				var conv = primitiveConverters.get (key);
  				if (!conv)
  					throw new Error ("Unknown parameter type " + type);
  
  				var localStep = Object.create (conv.steps[0]);
  				localStep.size = conv.size;
  				if (conv.needs_root)
  					needs_root_buffer = true;
  				localStep.needs_root = conv.needs_root;
  				localStep.key = args_marshal[i];
  				steps.push (localStep);
  				size += conv.size;
  			}
  
  			return {
  				steps: steps, size: size, args_marshal: args_marshal,
  				is_result_definitely_unmarshaled: is_result_definitely_unmarshaled,
  				is_result_possibly_unmarshaled: is_result_possibly_unmarshaled,
  				result_unmarshaled_if_argc: result_unmarshaled_if_argc,
  				needs_root_buffer: needs_root_buffer
  			};
  		},_get_converter_for_marshal_string:function (args_marshal) {
  			if (!this._signature_converters)
  				this._signature_converters = new Map();
  
  			var converter = this._signature_converters.get (args_marshal);
  			if (!converter) {
  				converter = this._create_converter_for_marshal_string (args_marshal);
  				this._signature_converters.set (args_marshal, converter);
  			}
  
  			return converter;
  		},_compile_converter_for_marshal_string:function (args_marshal) {
  			var converter = this._get_converter_for_marshal_string (args_marshal);
  			if (typeof (converter.args_marshal) !== "string")
  				throw new Error ("Corrupt converter for '" + args_marshal + "'");
  
  			if (converter.compiled_function && converter.compiled_variadic_function)
  				return converter;
  
  			var converterName = args_marshal.replace("!", "_result_unmarshaled");
  			converter.name = converterName;
  
  			var body = [];
  			var argumentNames = ["buffer", "rootBuffer", "method"];
  
  			// worst-case allocation size instead of allocating dynamically, plus padding
  			var bufferSizeBytes = converter.size + (args_marshal.length * 4) + 16;
  			var rootBufferSize = args_marshal.length;
  			// ensure the indirect values are 8-byte aligned so that aligned loads and stores will work
  			var indirectBaseOffset = ((((args_marshal.length * 4) + 7) / 8) | 0) * 8;
  
  			var closure = {};
  			var indirectLocalOffset = 0;
  
  			body.push (
  				`if (!buffer) buffer = Module._malloc (${bufferSizeBytes});`,
  				`var indirectStart = buffer + ${indirectBaseOffset};`,
  				"var indirect32 = (indirectStart / 4) | 0, indirect64 = (indirectStart / 8) | 0;",
  				"var buffer32 = (buffer / 4) | 0;",
  				""
  			);
  
  			for (let i = 0; i < converter.steps.length; i++) {
  				var step = converter.steps[i];
  				var closureKey = "step" + i;
  				var valueKey = "value" + i;
  
  				var argKey = "arg" + i;
  				argumentNames.push (argKey);
  
  				if (step.convert) {
  					closure[closureKey] = step.convert;
  					body.push (`var ${valueKey} = ${closureKey}(${argKey}, method, ${i});`);
  				} else {
  					body.push (`var ${valueKey} = ${argKey};`);
  				}
  
  				if (step.needs_root)
  					body.push (`rootBuffer.set (${i}, ${valueKey});`);
  
  				if (step.indirect) {
  					var heapArrayName = null;
  
  					switch (step.indirect) {
  						case "u32":
  							heapArrayName = "HEAPU32";
  							break;
  						case "i32":
  							heapArrayName = "HEAP32";
  							break;
  						case "float":
  							heapArrayName = "HEAPF32";
  							break;
  						case "double":
  							body.push (`Module.HEAPF64[indirect64 + ${(indirectLocalOffset / 8)}] = ${valueKey};`);
  							break;
  						case "i64":
  							body.push (`Module.setValue (indirectStart + ${indirectLocalOffset}, ${valueKey}, 'i64');`);
  							break;
  						default:
  							throw new Error ("Unimplemented indirect type: " + step.indirect);
  					}
  
  					if (heapArrayName)
  						body.push (`Module.${heapArrayName}[indirect32 + ${(indirectLocalOffset / 4)}] = ${valueKey};`);
  
  					body.push (`Module.HEAP32[buffer32 + ${i}] = indirectStart + ${indirectLocalOffset};`, "");
  					indirectLocalOffset += step.size;
  				} else {
  					body.push (`Module.HEAP32[buffer32 + ${i}] = ${valueKey};`, "");
  					indirectLocalOffset += 4;
  				}
  			}
  
  			body.push ("return buffer;");
  
  			var bodyJs = body.join ("\r\n"), compiledFunction = null, compiledVariadicFunction = null;
  			try {
  				compiledFunction = this._create_named_function("converter_" + converterName, argumentNames, bodyJs, closure);
  				converter.compiled_function = compiledFunction;
  			} catch (exc) {
  				converter.compiled_function = null;
  				console.warn("compiling converter failed for", bodyJs, "with error", exc);
  				throw exc;
  			}
  
  			argumentNames = ["existingBuffer", "rootBuffer", "method", "args"];
  			closure = {
  				converter: compiledFunction
  			};
  			body = [
  				"return converter(",
  				"  existingBuffer, rootBuffer, method,"
  			];
  
  			for (let i = 0; i < converter.steps.length; i++) {
  				body.push(
  					"  args[" + i +
  					(
  						(i == converter.steps.length - 1)
  							? "]"
  							: "], "
  					)
  				);
  			}
  
  			body.push(");");
  
  			bodyJs = body.join ("\r\n");
  			try {
  				compiledVariadicFunction = this._create_named_function("variadic_converter_" + converterName, argumentNames, bodyJs, closure);
  				converter.compiled_variadic_function = compiledVariadicFunction;
  			} catch (exc) {
  				converter.compiled_variadic_function = null;
  				console.warn("compiling converter failed for", bodyJs, "with error", exc);
  				throw exc;
  			}
  
  			converter.scratchRootBuffer = null;
  			converter.scratchBuffer = 0 | 0;
  
  			return converter;
  		},_verify_args_for_method_call:function (args_marshal, args) {
  			var has_args = args && (typeof args === "object") && args.length > 0;
  			var has_args_marshal = typeof args_marshal === "string";
  
  			if (has_args) {
  				if (!has_args_marshal)
  					throw new Error ("No signature provided for method call.");
  				else if (args.length > args_marshal.length)
  					throw new Error ("Too many parameter values. Expected at most " + args_marshal.length + " value(s) for signature " + args_marshal);
  			}
  
  			return has_args_marshal && has_args;
  		},_get_buffer_for_method_call:function (converter) {
  			if (!converter)
  				return 0;
  
  			var result = converter.scratchBuffer;
  			converter.scratchBuffer = 0;
  			return result;
  		},_get_args_root_buffer_for_method_call:function (converter) {
  			if (!converter)
  				return null;
  
  			if (!converter.needs_root_buffer)
  				return null;
  
  			var result;
  			if (converter.scratchRootBuffer) {
  				result = converter.scratchRootBuffer;
  				converter.scratchRootBuffer = null;
  			} else {
  				// TODO: Expand the converter's heap allocation and then use
  				//  mono_wasm_new_root_buffer_from_pointer instead. Not that important
  				//  at present because the scratch buffer will be reused unless we are
  				//  recursing through a re-entrant call
  				result = MONO.mono_wasm_new_root_buffer (converter.steps.length);
  				result.converter = converter;
  			}
  			return result;
  		},_release_args_root_buffer_from_method_call:function (converter, argsRootBuffer) {
  			if (!argsRootBuffer || !converter)
  				return;
  
  			// Store the arguments root buffer for re-use in later calls
  			if (!converter.scratchRootBuffer) {
  				argsRootBuffer.clear ();
  				converter.scratchRootBuffer = argsRootBuffer;
  			} else {
  				argsRootBuffer.release ();
  			}
  		},_release_buffer_from_method_call:function (converter, buffer) {
  			if (!converter || !buffer)
  				return;
  
  			if (!converter.scratchBuffer)
  				converter.scratchBuffer = buffer | 0;
  			else
  				Module._free (buffer | 0);
  		},_convert_exception_for_method_call:function (result, exception) {
  			if (exception === 0)
  				return null;
  
  			var msg = this.conv_string (result);
  			var err = new Error (msg); //the convention is that invoke_method ToString () any outgoing exception
  			// console.warn ("error", msg, "at location", err.stack);
  			return err;
  		},_maybe_produce_signature_warning:function (converter) {
  			if (converter.has_warned_about_signature)
  				return;
  
  			console.warn ("MONO_WASM: Deprecated raw return value signature: '" + converter.args_marshal + "'. End the signature with '!' instead of 'm'.");
  			converter.has_warned_about_signature = true;
  		},_decide_if_result_is_marshaled:function (converter, argc) {
  			if (!converter)
  				return true;
  
  			if (
  				converter.is_result_possibly_unmarshaled &&
  				(argc === converter.result_unmarshaled_if_argc)
  			) {
  				if (argc < converter.result_unmarshaled_if_argc)
  					throw new Error(["Expected >= ", converter.result_unmarshaled_if_argc, "argument(s) but got", argc, "for signature " + converter.args_marshal].join(" "));
  
  				this._maybe_produce_signature_warning (converter);
  				return false;
  			} else {
  				if (argc < converter.steps.length)
  					throw new Error(["Expected", converter.steps.length, "argument(s) but got", argc, "for signature " + converter.args_marshal].join(" "));
  
  				return !converter.is_result_definitely_unmarshaled;
  			}
  		},call_method:function (method, this_arg, args_marshal, args) {
  			this.bindings_lazy_init ();
  
  			// HACK: Sometimes callers pass null or undefined, coerce it to 0 since that's what wasm expects
  			this_arg = this_arg | 0;
  
  			// Detect someone accidentally passing the wrong type of value to method
  			if ((method | 0) !== method)
  				throw new Error (`method must be an address in the native heap, but was '${method}'`);
  			if (!method)
  				throw new Error ("no method specified");
  
  			var needs_converter = this._verify_args_for_method_call (args_marshal, args);
  
  			var buffer = 0, converter = null, argsRootBuffer = null;
  			var is_result_marshaled = true;
  
  			// check if the method signature needs argument mashalling
  			if (needs_converter) {
  				converter = this._compile_converter_for_marshal_string (args_marshal);
  
  				is_result_marshaled = this._decide_if_result_is_marshaled (converter, args.length);
  
  				argsRootBuffer = this._get_args_root_buffer_for_method_call (converter);
  
  				var scratchBuffer = this._get_buffer_for_method_call (converter);
  
  				buffer = converter.compiled_variadic_function (scratchBuffer, argsRootBuffer, method, args);
  			}
  			return this._call_method_with_converted_args (method, this_arg, converter, buffer, is_result_marshaled, argsRootBuffer);
  		},_handle_exception_for_call:function (
  			converter, buffer, resultRoot, exceptionRoot, argsRootBuffer
  		) {
  			var exc = this._convert_exception_for_method_call (resultRoot.value, exceptionRoot.value);
  			if (!exc)
  				return;
  
  			this._teardown_after_call (converter, buffer, resultRoot, exceptionRoot, argsRootBuffer);
  			throw exc;
  		},_handle_exception_and_produce_result_for_call:function (
  			converter, buffer, resultRoot, exceptionRoot, argsRootBuffer, is_result_marshaled
  		) {
  			this._handle_exception_for_call (converter, buffer, resultRoot, exceptionRoot, argsRootBuffer);
  
  			if (is_result_marshaled)
  				result = this._unbox_mono_obj_root (resultRoot);
  			else
  				result = resultRoot.value;
  
  			this._teardown_after_call (converter, buffer, resultRoot, exceptionRoot, argsRootBuffer);
  			return result;
  		},_teardown_after_call:function (converter, buffer, resultRoot, exceptionRoot, argsRootBuffer) {
  			this._release_args_root_buffer_from_method_call (converter, argsRootBuffer);
  			this._release_buffer_from_method_call (converter, buffer | 0);
  
  			if (resultRoot)
  				resultRoot.release ();
  			if (exceptionRoot)
  				exceptionRoot.release ();
  		},_get_method_description:function (method) {
  			if (!this._method_descriptions)
  				this._method_descriptions = new Map();
  
  			var result = this._method_descriptions.get (method);
  			if (!result)
  				result = "method#" + method;
  			return result;
  		},_call_method_with_converted_args:function (method, this_arg, converter, buffer, is_result_marshaled, argsRootBuffer) {
  			var resultRoot = MONO.mono_wasm_new_root (), exceptionRoot = MONO.mono_wasm_new_root ();
  			resultRoot.value = this.invoke_method (method, this_arg, buffer, exceptionRoot.get_address ());
  			return this._handle_exception_and_produce_result_for_call (converter, buffer, resultRoot, exceptionRoot, argsRootBuffer, is_result_marshaled);
  		},bind_method:function (method, this_arg, args_marshal, friendly_name) {
  			this.bindings_lazy_init ();
  
  			this_arg = this_arg | 0;
  
  			var converter = null;
  			if (typeof (args_marshal) === "string")
  				converter = this._compile_converter_for_marshal_string (args_marshal);
  
  			var closure = {
  				library_mono: MONO,
  				binding_support: this,
  				method: method,
  				this_arg: this_arg
  			};
  
  			var converterKey = "converter_" + converter.name;
  
  			if (converter)
  				closure[converterKey] = converter;
  
  			var argumentNames = [];
  			var body = [
  				"var resultRoot = library_mono.mono_wasm_new_root (), exceptionRoot = library_mono.mono_wasm_new_root ();",
  				""
  			];
  
  			if (converter) {
  				body.push(
  					`var argsRootBuffer = binding_support._get_args_root_buffer_for_method_call (${converterKey});`,
  					`var scratchBuffer = binding_support._get_buffer_for_method_call (${converterKey});`,
  					`var buffer = ${converterKey}.compiled_function (`,
  					"    scratchBuffer, argsRootBuffer, method,"
  				);
  
  				for (var i = 0; i < converter.steps.length; i++) {
  					var argName = "arg" + i;
  					argumentNames.push(argName);
  					body.push(
  						"    " + argName +
  						(
  							(i == converter.steps.length - 1)
  								? ""
  								: ", "
  						)
  					);
  				}
  
  				body.push(");");
  
  			} else {
  				body.push("var argsRootBuffer = null, buffer = 0;");
  			}
  
  			if (converter.is_result_definitely_unmarshaled) {
  				body.push ("var is_result_marshaled = false;");
  			} else if (converter.is_result_possibly_unmarshaled) {
  				body.push (`var is_result_marshaled = arguments.length !== ${converter.result_unmarshaled_if_argc};`);
  			} else {
  				body.push ("var is_result_marshaled = true;");
  			}
  
  			// We inline a bunch of the invoke and marshaling logic here in order to eliminate the GC pressure normally
  			//  created by the unboxing part of the call process. Because unbox_mono_obj(_root) can return non-numeric
  			//  types, v8 and spidermonkey allocate and store its result on the heap (in the nursery, to be fair).
  			// For a bound method however, we know the result will always be the same type because C# methods have known
  			//  return types. Inlining the invoke and marshaling logic means that even though the bound method has logic
  			//  for handling various types, only one path through the method (for its appropriate return type) will ever
  			//  be taken, and the JIT will see that the 'result' local and thus the return value of this function are
  			//  always of the exact same type. All of the branches related to this end up being predicted and low-cost.
  			// The end result is that bound method invocations don't always allocate, so no more nursery GCs. Yay! -kg
  			body.push(
  				"",
  				"resultRoot.value = binding_support.invoke_method (method, this_arg, buffer, exceptionRoot.get_address ());",
  				`binding_support._handle_exception_for_call (${converterKey}, buffer, resultRoot, exceptionRoot, argsRootBuffer);`,
  				"",
  				"var result = undefined;",
  				"if (!is_result_marshaled) ",
  				"    result = resultRoot.value;",
  				"else if (resultRoot.value !== 0) {",
  				// For the common scenario where the return type is a primitive, we want to try and unbox it directly
  				//  into our existing heap allocation and then read it out of the heap. Doing this all in one operation
  				//  means that we only need to enter a gc safe region twice (instead of 3+ times with the normal,
  				//  slower check-type-and-then-unbox flow which has extra checks since unbox verifies the type).
  				"    var resultType = binding_support.mono_wasm_try_unbox_primitive_and_get_type (resultRoot.value, buffer);",
  				"    switch (resultType) {",
  				"    case 1:", // int
  				"        result = Module.HEAP32[buffer / 4]; break;",
  				"    case 25:", // uint32
  				"        result = Module.HEAPU32[buffer / 4]; break;",
  				"    case 24:", // float32
  				"        result = Module.HEAPF32[buffer / 4]; break;",
  				"    case 2:", // float64
  				"        result = Module.HEAPF64[buffer / 8]; break;",
  				"    case 8:", // boolean
  				"        result = (Module.HEAP32[buffer / 4]) !== 0; break;",
  				"    case 28:", // char
  				"        result = String.fromCharCode(Module.HEAP32[buffer / 4]); break;",
  				"    default:",
  				"        result = binding_support._unbox_mono_obj_root_with_known_nonprimitive_type (resultRoot, resultType); break;",
  				"    }",
  				"}",
  				"",
  				`binding_support._teardown_after_call (${converterKey}, buffer, resultRoot, exceptionRoot, argsRootBuffer);`,
  				"return result;"
  			);
  
  			bodyJs = body.join ("\r\n");
  
  			if (friendly_name) {
  				var escapeRE = /[^A-Za-z0-9_]/g;
  				friendly_name = friendly_name.replace(escapeRE, "_");
  			}
  
  			var displayName = "managed_" + (friendly_name || method);
  
  			if (this_arg)
  				displayName += "_with_this_" + this_arg;
  
  			return this._create_named_function(displayName, argumentNames, bodyJs, closure);
  		},resolve_method_fqn:function (fqn) {
  			this.bindings_lazy_init ();
  
  			var assembly = fqn.substring(fqn.indexOf ("[") + 1, fqn.indexOf ("]")).trim();
  			fqn = fqn.substring (fqn.indexOf ("]") + 1).trim();
  
  			var methodname = fqn.substring(fqn.indexOf (":") + 1);
  			fqn = fqn.substring (0, fqn.indexOf (":")).trim ();
  
  			var namespace = "";
  			var classname = fqn;
  			if (fqn.indexOf(".") != -1) {
  				var idx = fqn.lastIndexOf(".");
  				namespace = fqn.substring (0, idx);
  				classname = fqn.substring (idx + 1);
  			}
  
  			if (!assembly.trim())
  				throw new Error("No assembly name specified");
  			if (!classname.trim())
  				throw new Error("No class name specified");
  			if (!methodname.trim())
  				throw new Error("No method name specified");
  
  			var asm = this.assembly_load (assembly);
  			if (!asm)
  				throw new Error ("Could not find assembly: " + assembly);
  
  			var klass = this.find_class(asm, namespace, classname);
  			if (!klass)
  				throw new Error ("Could not find class: " + namespace + ":" + classname + " in assembly " + assembly);
  
  			var method = this.find_method (klass, methodname, -1);
  			if (!method)
  				throw new Error ("Could not find method: " + methodname);
  			return method;
  		},call_static_method:function (fqn, args, signature) {
  			this.bindings_lazy_init ();
  
  			var method = this.resolve_method_fqn (fqn);
  
  			if (typeof signature === "undefined")
  				signature = Module.mono_method_get_call_signature (method);
  
  			return this.call_method (method, null, signature, args);
  		},bind_static_method:function (fqn, signature) {
  			this.bindings_lazy_init ();
  
  			var method = this.resolve_method_fqn (fqn);
  
  			if (typeof signature === "undefined")
  				signature = Module.mono_method_get_call_signature (method);
  
  			return BINDING.bind_method (method, null, signature, fqn);
  		},bind_assembly_entry_point:function (assembly, signature) {
  			this.bindings_lazy_init ();
  
  			var asm = this.assembly_load (assembly);
  			if (!asm)
  				throw new Error ("Could not find assembly: " + assembly);
  
  			var method = this.assembly_get_entry_point(asm);
  			if (!method)
  				throw new Error ("Could not find entry point for assembly: " + assembly);
  
  			if (typeof signature === "undefined")
  				signature = Module.mono_method_get_call_signature (method);
  
  			return function() {
  				try {
  					var args = [...arguments];
  					if (args.length > 0 && Array.isArray (args[0]))
  						args[0] = BINDING.js_array_to_mono_array (args[0], true, false);
  
  					let result = BINDING.call_method (method, null, signature, args);
  					return Promise.resolve (result);
  				} catch (error) {
  					return Promise.reject (error);
  				}
  			};
  		},call_assembly_entry_point:function (assembly, args, signature) {
  			return this.bind_assembly_entry_point (assembly, signature) (...args)
  		},mono_wasm_get_jsobj_from_js_handle:function(js_handle) {
  			if (js_handle > 0)
  				return this._cs_owned_objects_by_js_handle[js_handle];
  			return null;
  		},mono_wasm_get_js_handle:function(js_obj) {
  			if(js_obj[BINDING.cs_owned_js_handle_symbol]){
  				return js_obj[BINDING.cs_owned_js_handle_symbol];
  			}
  			var js_handle = this._js_handle_free_list.length ? this._js_handle_free_list.pop() : this._next_js_handle++;
  			// note _cs_owned_objects_by_js_handle is list, not Map. That's why we maintain _js_handle_free_list.
  			this._cs_owned_objects_by_js_handle[js_handle] = js_obj;
  			js_obj[BINDING.cs_owned_js_handle_symbol] = js_handle;
  			return js_handle;
  		},_mono_wasm_release_js_handle:function(js_handle) {
  			var obj = BINDING._cs_owned_objects_by_js_handle[js_handle];
  			if (typeof obj  !== "undefined" && obj !== null) {
  				// if this is the global object then do not
  				// unregister it.
  				if (globalThis === obj)
  					return obj;
  
  				if (typeof obj[BINDING.cs_owned_js_handle_symbol]  !== "undefined") {
  					obj[BINDING.cs_owned_js_handle_symbol] = undefined;
  				}
  
  				BINDING._cs_owned_objects_by_js_handle[js_handle] = undefined;
  				BINDING._js_handle_free_list.push(js_handle);
  			}
  			return obj;
  		}};
  function _mono_wasm_add_event_listener(objHandle, name, listener_gc_handle, optionsHandle) {
  		var nameRoot = MONO.mono_wasm_new_root (name);
  		try {
  			BINDING.bindings_lazy_init ();
  			var sName = BINDING.conv_string(nameRoot.value);
  
  			var obj = BINDING.mono_wasm_get_jsobj_from_js_handle(objHandle);
  			if (!obj)
  				throw new Error("ERR09: Invalid JS object handle for '"+sName+"'");
  
  			const prevent_timer_throttling = !BINDING.isChromium || obj.constructor.name !== 'WebSocket'
  				? null
  				: () => MONO.prevent_timer_throttling(0);
  
  			var listener = BINDING._wrap_delegate_gc_handle_as_function(listener_gc_handle, prevent_timer_throttling);
  			if (!listener)
  				throw new Error("ERR10: Invalid listener gc_handle");
  
  			var options = optionsHandle
  				? BINDING.mono_wasm_get_jsobj_from_js_handle(optionsHandle)
  				: null;
  
  			if(!BINDING._use_finalization_registry){
  				// we are counting registrations because same delegate could be registered into multiple sources
  				listener[BINDING.listener_registration_count_symbol] = listener[BINDING.listener_registration_count_symbol] ? listener[BINDING.listener_registration_count_symbol] + 1 : 1;
  			}
  
  			if (options)
  				obj.addEventListener(sName, listener, options);
  			else
  				obj.addEventListener(sName, listener);
  			return 0;
  		} catch (exc) {
  			return BINDING.js_string_to_mono_string(exc.message);
  		} finally {
  			nameRoot.release();
  		}
  	}

  function _mono_wasm_asm_loaded(assembly_name, assembly_ptr, assembly_len, pdb_ptr, pdb_len) {
  		// Only trigger this codepath for assemblies loaded after app is ready
  		if (MONO.mono_wasm_runtime_is_ready !== true)
  			return;
  
  		const assembly_name_str = assembly_name !== 0 ? Module.UTF8ToString(assembly_name).concat('.dll') : '';
  
  		const assembly_data = new Uint8Array(Module.HEAPU8.buffer, assembly_ptr, assembly_len);
  		const assembly_b64 = MONO._base64Converter.toBase64StringImpl(assembly_data);
  
  		let pdb_b64;
  		if (pdb_ptr) {
  			const pdb_data = new Uint8Array(Module.HEAPU8.buffer, pdb_ptr, pdb_len);
  			pdb_b64 = MONO._base64Converter.toBase64StringImpl(pdb_data);
  		}
  
  		MONO.mono_wasm_raise_debug_event({
  			eventName: 'AssemblyLoaded',
  			assembly_name: assembly_name_str,
  			assembly_b64,
  			pdb_b64
  		});
  	}

  function _mono_wasm_create_cs_owned_object(core_name, args, is_exception) {
  		var argsRoot = MONO.mono_wasm_new_root (args), nameRoot = MONO.mono_wasm_new_root (core_name);
  		try {
  			BINDING.bindings_lazy_init ();
  
  			var js_name = BINDING.conv_string (nameRoot.value);
  
  			if (!js_name) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("Invalid name @" + nameRoot.value);
  			}
  
  			var coreObj = globalThis[js_name];
  
  			if (coreObj === null || typeof coreObj === "undefined") {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("JavaScript host object '" + js_name + "' not found.");
  			}
  
  			var js_args = BINDING._mono_array_root_to_js_array(argsRoot);
  
  			try {
  
  				// This is all experimental !!!!!!
  				var allocator = function(constructor, js_args) {
  					// Not sure if we should be checking for anything here
  					var argsList = new Array();
  					argsList[0] = constructor;
  					if (js_args)
  						argsList = argsList.concat (js_args);
  					var tempCtor = constructor.bind.apply (constructor, argsList);
  					var js_obj = new tempCtor ();
  					return js_obj;
  				};
  
  				var js_obj = allocator(coreObj, js_args);
  				var js_handle = BINDING.mono_wasm_get_js_handle(js_obj);
  				// returns boxed js_handle int, because on exception we need to return String on same method signature
  				// here we don't have anything to in-flight reference, as the JSObject doesn't exist yet
  				return BINDING._js_to_mono_obj(false, js_handle);
  			} catch (e) {
  				var res = e.toString ();
  				setValue (is_exception, 1, "i32");
  				if (res === null || res === undefined)
  					res = "Error allocating object.";
  				return BINDING.js_string_to_mono_string (res);
  			}
  		} finally {
  			argsRoot.release();
  			nameRoot.release();
  		}
  	}

  function _mono_wasm_fire_debugger_agent_message() {
  		// eslint-disable-next-line no-debugger
  		debugger;
  	}

  function _mono_wasm_get_by_index(js_handle, property_index, is_exception) {
  		BINDING.bindings_lazy_init ();
  
  		var obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  		if (!obj) {
  			setValue (is_exception, 1, "i32");
  			return BINDING.js_string_to_mono_string ("ERR03: Invalid JS object handle '" + js_handle + "' while getting ["+property_index+"]");
  		}
  
  		try {
  			var m = obj [property_index];
  			return BINDING._js_to_mono_obj (true, m);
  		} catch (e) {
  			var res = e.toString ();
  			setValue (is_exception, 1, "i32");
  			if (res === null || typeof res === "undefined")
  				res = "unknown exception";
  			return BINDING.js_string_to_mono_string (res);
  		}
  	}

  function _mono_wasm_get_global_object(global_name, is_exception) {
  		var nameRoot = MONO.mono_wasm_new_root (global_name);
  		try {
  			BINDING.bindings_lazy_init ();
  
  			var js_name = BINDING.conv_string (nameRoot.value);
  
  			var globalObj;
  
  			if (!js_name) {
  				globalObj = globalThis;
  			}
  			else {
  				globalObj = globalThis[js_name];
  			}
  
  			// TODO returning null may be useful when probing for browser features
  			if (globalObj === null || typeof globalObj === undefined) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("Global object '" + js_name + "' not found.");
  			}
  
  			return BINDING._js_to_mono_obj (true, globalObj);
  		} finally {
  			nameRoot.release();
  		}
  	}

  function _mono_wasm_get_object_property(js_handle, property_name, is_exception) {
  		BINDING.bindings_lazy_init ();
  
  		var nameRoot = MONO.mono_wasm_new_root (property_name);
  		try {
  			var js_name = BINDING.conv_string (nameRoot.value);
  			if (!js_name) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("Invalid property name object '" + nameRoot.value + "'");
  			}
  
  			var obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  			if (!obj) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("ERR01: Invalid JS object handle '" + js_handle + "' while geting '"+js_name+"'");
  			}
  
  			var res;
  			try {
  				var m = obj [js_name];
  
  				return BINDING._js_to_mono_obj (true, m);
  			} catch (e) {
  				var res = e.toString ();
  				setValue (is_exception, 1, "i32");
  				if (res === null || typeof res === "undefined")
  					res = "unknown exception";
  				return BINDING.js_string_to_mono_string (res);
  			}
  		} finally {
  			nameRoot.release();
  		}
  	}

  var DOTNET={conv_string:function (mono_obj) {
  			return MONO.string_decoder.copy (mono_obj);
  		}};
  function _mono_wasm_invoke_js_blazor(exceptionMessage, callInfo, arg0, arg1, arg2)	{
  		var mono_string = globalThis._mono_string_cached
  			|| (globalThis._mono_string_cached = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']));
  
  		try {
  			var blazorExports = globalThis.Blazor;
  			if (!blazorExports) {
  				throw new Error('The blazor.webassembly.js library is not loaded.');
  			}
  
  			return blazorExports._internal.invokeJSFromDotNet(callInfo, arg0, arg1, arg2);
  		} catch (ex) {
  			var exceptionJsString = ex.message + '\n' + ex.stack;
  			var exceptionSystemString = mono_string(exceptionJsString);
  			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
  			return 0;
  		}
  	}

  function _mono_wasm_invoke_js_marshalled(exceptionMessage, asyncHandleLongPtr, functionName, argsJson, treatResultAsVoid) {
  
  		var mono_string = globalThis._mono_string_cached
  			|| (globalThis._mono_string_cached = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']));
  
  		try {
  			// Passing a .NET long into JS via Emscripten is tricky. The method here is to pass
  			// as pointer to the long, then combine two reads from the HEAPU32 array.
  			// Even though JS numbers can't represent the full range of a .NET long, it's OK
  			// because we'll never exceed Number.MAX_SAFE_INTEGER (2^53 - 1) in this case.
  			//var u32Index = $1 >> 2;
  			var u32Index = asyncHandleLongPtr >> 2;
  			var asyncHandleJsNumber = Module.HEAPU32[u32Index + 1]*4294967296 + Module.HEAPU32[u32Index];
  
  			// var funcNameJsString = UTF8ToString (functionName);
  			// var argsJsonJsString = argsJson && UTF8ToString (argsJson);
  			var funcNameJsString = DOTNET.conv_string(functionName);
  			var argsJsonJsString = argsJson && DOTNET.conv_string (argsJson);
  
  			var dotNetExports = globaThis.DotNet;
  			if (!dotNetExports) {
  				throw new Error('The Microsoft.JSInterop.js library is not loaded.');
  			}
  
  			if (asyncHandleJsNumber) {
  				dotNetExports.jsCallDispatcher.beginInvokeJSFromDotNet(asyncHandleJsNumber, funcNameJsString, argsJsonJsString, treatResultAsVoid);
  				return 0;
  			} else {
  				var resultJson = dotNetExports.jsCallDispatcher.invokeJSFromDotNet(funcNameJsString, argsJsonJsString, treatResultAsVoid);
  				return resultJson === null ? 0 : mono_string(resultJson);
  			}
  		} catch (ex) {
  			var exceptionJsString = ex.message + '\n' + ex.stack;
  			var exceptionSystemString = mono_string(exceptionJsString);
  			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
  			return 0;
  		}
  	}

  function _mono_wasm_invoke_js_unmarshalled(exceptionMessage, funcName, arg0, arg1, arg2)	{
  		try {
  			// Get the function you're trying to invoke
  			var funcNameJsString = DOTNET.conv_string(funcName);
  			var dotNetExports = globalThis.DotNet;
  			if (!dotNetExports) {
  				throw new Error('The Microsoft.JSInterop.js library is not loaded.');
  			}
  			var funcInstance = dotNetExports.jsCallDispatcher.findJSFunction(funcNameJsString);
  
  			return funcInstance.call(null, arg0, arg1, arg2);
  		} catch (ex) {
  			var exceptionJsString = ex.message + '\n' + ex.stack;
  			var mono_string = Module.cwrap('mono_wasm_string_from_js', 'number', ['string']); // TODO: Cache
  			var exceptionSystemString = mono_string(exceptionJsString);
  			setValue (exceptionMessage, exceptionSystemString, 'i32'); // *exceptionMessage = exceptionSystemString;
  			return 0;
  		}
  	}

  function _mono_wasm_invoke_js_with_args(js_handle, method_name, args, is_exception) {
  		let argsRoot = MONO.mono_wasm_new_root (args), nameRoot = MONO.mono_wasm_new_root (method_name);
  		try {
  			BINDING.bindings_lazy_init ();
  
  			var js_name = BINDING.conv_string (nameRoot.value);
  			if (!js_name || (typeof(js_name) !== "string")) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("ERR12: Invalid method name object '" + nameRoot.value + "'");
  			}
  
  			var obj = BINDING.get_js_obj (js_handle);
  			if (!obj) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("ERR13: Invalid JS object handle '" + js_handle + "' while invoking '"+js_name+"'");
  			}
  
  			var js_args = BINDING._mono_array_root_to_js_array(argsRoot);
  
  			var res;
  			try {
  				var m = obj [js_name];
  				if (typeof m === "undefined")
  					throw new Error("Method: '" + js_name + "' not found for: '" + Object.prototype.toString.call(obj) + "'");
  				var res = m.apply (obj, js_args);
  				return BINDING._js_to_mono_obj(true, res);
  			} catch (e) {
  				var res = e.toString ();
  				setValue (is_exception, 1, "i32");
  				if (res === null || res === undefined)
  					res = "unknown exception";
  				return BINDING.js_string_to_mono_string (res);
  			}
  		} finally {
  			argsRoot.release();
  			nameRoot.release();
  		}
  	}

  function _mono_wasm_release_cs_owned_object(js_handle) {
  		BINDING.bindings_lazy_init ();
  		BINDING._mono_wasm_release_js_handle(js_handle);
  	}

  function _mono_wasm_remove_event_listener(objHandle, name, listener_gc_handle, capture) {
  		var nameRoot = MONO.mono_wasm_new_root (name);
  		try {
  			BINDING.bindings_lazy_init ();
  			var obj = BINDING.mono_wasm_get_jsobj_from_js_handle(objHandle);
  			if (!obj)
  				throw new Error("ERR11: Invalid JS object handle");
  			var listener = BINDING._lookup_js_owned_object(listener_gc_handle);
  			// Removing a nonexistent listener should not be treated as an error
  			if (!listener)
  				return;
  			var sName = BINDING.conv_string(nameRoot.value);
  
  			obj.removeEventListener(sName, listener, !!capture);
  			// We do not manually remove the listener from the delegate registry here,
  			//  because that same delegate may have been used as an event listener for
  			//  other events or event targets. The GC will automatically clean it up
  			//  and trigger the FinalizationRegistry handler if it's unused
  
  			// When FinalizationRegistry is not supported by this browser, we cleanup manuall after unregistration
  			if (!BINDING._use_finalization_registry) {
  				listener[BINDING.listener_registration_count_symbol]--;
  				if (listener[BINDING.listener_registration_count_symbol] === 0) {
  					BINDING._js_owned_object_table.delete(listener_gc_handle);
  					BINDING._release_js_owned_object_by_gc_handle(listener_gc_handle);
  				}
  			}
  
  			return 0;
  		} catch (exc) {
  			return BINDING.js_string_to_mono_string(exc.message);
  		} finally {
  			nameRoot.release();
  		}
  	}

  function _mono_wasm_set_by_index(js_handle, property_index, value, is_exception) {
  		var valueRoot = MONO.mono_wasm_new_root (value);
  		try {
  			BINDING.bindings_lazy_init ();
  
  			var obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  			if (!obj) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("ERR04: Invalid JS object handle '" + js_handle + "' while setting ["+property_index+"]");
  			}
  
  			var js_value = BINDING._unbox_mono_obj_root(valueRoot);
  
  			try {
  				obj [property_index] = js_value;
  				return true;
  			} catch (e) {
  				var res = e.toString ();
  				setValue (is_exception, 1, "i32");
  				if (res === null || typeof res === "undefined")
  					res = "unknown exception";
  				return BINDING.js_string_to_mono_string (res);
  			}
  		} finally {
  			valueRoot.release();
  		}
  	}

  function _mono_wasm_set_object_property(js_handle, property_name, value, createIfNotExist, hasOwnProperty, is_exception) {
  		var valueRoot = MONO.mono_wasm_new_root (value), nameRoot = MONO.mono_wasm_new_root (property_name);
  		try {
  			BINDING.bindings_lazy_init ();
  			var property = BINDING.conv_string (nameRoot.value);
  			if (!property) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("Invalid property name object '" + property_name + "'");
  			}
  
  			var js_obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  			if (!js_obj) {
  				setValue (is_exception, 1, "i32");
  				return BINDING.js_string_to_mono_string ("ERR02: Invalid JS object handle '" + js_handle + "' while setting '"+property+"'");
  			}
  
  			var result = false;
  
  			var js_value = BINDING._unbox_mono_obj_root(valueRoot);
  
  			if (createIfNotExist) {
  				js_obj[property] = js_value;
  				result = true;
  			}
  			else {
  				result = false;
  				if (!createIfNotExist)
  				{
  					if (!js_obj.hasOwnProperty(property))
  						return false;
  				}
  				if (hasOwnProperty === true) {
  					if (js_obj.hasOwnProperty(property)) {
  						js_obj[property] = js_value;
  						result = true;
  					}
  				}
  				else {
  					js_obj[property] = js_value;
  					result = true;
  				}
  
  			}
  			return BINDING._box_js_bool (result);
  		} finally {
  			nameRoot.release();
  			valueRoot.release();
  		}
  	}

  function _mono_wasm_typed_array_copy_from(js_handle, pinned_array, begin, end, bytes_per_element, is_exception) {
  		BINDING.bindings_lazy_init ();
  
  		var js_obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  		if (!js_obj) {
  			setValue (is_exception, 1, "i32");
  			return BINDING.js_string_to_mono_string ("ERR08: Invalid JS object handle '" + js_handle + "'");
  		}
  
  		var res = BINDING.typedarray_copy_from(js_obj, pinned_array, begin, end, bytes_per_element);
  		// returns num_of_bytes boxed
  		return BINDING._js_to_mono_obj (false, res)
  	}

  function _mono_wasm_typed_array_copy_to(js_handle, pinned_array, begin, end, bytes_per_element, is_exception) {
  		BINDING.bindings_lazy_init ();
  
  		var js_obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  		if (!js_obj) {
  			setValue (is_exception, 1, "i32");
  			return BINDING.js_string_to_mono_string ("ERR07: Invalid JS object handle '" + js_handle + "'");
  		}
  
  		var res = BINDING.typedarray_copy_to(js_obj, pinned_array, begin, end, bytes_per_element);
  		// returns num_of_bytes boxed
  		return BINDING._js_to_mono_obj (false, res)
  	}

  function _mono_wasm_typed_array_from(pinned_array, begin, end, bytes_per_element, type, is_exception) {
  		BINDING.bindings_lazy_init ();
  		var res = BINDING.typed_array_from(pinned_array, begin, end, bytes_per_element, type);
  		// returns JS typed array like Int8Array, to be wraped with JSObject proxy
  		return BINDING._js_to_mono_obj (true, res)
  	}

  function _mono_wasm_typed_array_to_array(js_handle, is_exception) {
  		BINDING.bindings_lazy_init ();
  
  		var js_obj = BINDING.mono_wasm_get_jsobj_from_js_handle (js_handle);
  		if (!js_obj) {
  			setValue (is_exception, 1, "i32");
  			return BINDING.js_string_to_mono_string ("ERR06: Invalid JS object handle '" + js_handle + "'");
  		}
  
  		// returns pointer to C# array
  		return BINDING.js_typed_array_to_array(js_obj, false);
  	}

  function _schedule_background_exec() {
  		++MONO.pump_count;
  		if (typeof globalThis.setTimeout === 'function') {
  			globalThis.setTimeout (MONO.pump_message, 0);
  		}
  	}

  function __isLeapYear(year) {
        return year%4 === 0 && (year%100 !== 0 || year%400 === 0);
    }
  
  function __arraySum(array, index) {
      var sum = 0;
      for (var i = 0; i <= index; sum += array[i++]) {
        // no-op
      }
      return sum;
    }
  
  var __MONTH_DAYS_LEAP=[31,29,31,30,31,30,31,31,30,31,30,31];
  
  var __MONTH_DAYS_REGULAR=[31,28,31,30,31,30,31,31,30,31,30,31];
  function __addDays(date, days) {
      var newDate = new Date(date.getTime());
      while (days > 0) {
        var leap = __isLeapYear(newDate.getFullYear());
        var currentMonth = newDate.getMonth();
        var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
  
        if (days > daysInCurrentMonth-newDate.getDate()) {
          // we spill over to next month
          days -= (daysInCurrentMonth-newDate.getDate()+1);
          newDate.setDate(1);
          if (currentMonth < 11) {
            newDate.setMonth(currentMonth+1)
          } else {
            newDate.setMonth(0);
            newDate.setFullYear(newDate.getFullYear()+1);
          }
        } else {
          // we stay in current month
          newDate.setDate(newDate.getDate()+days);
          return newDate;
        }
      }
  
      return newDate;
    }
  function _strftime(s, maxsize, format, tm) {
      // size_t strftime(char *restrict s, size_t maxsize, const char *restrict format, const struct tm *restrict timeptr);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/strftime.html
  
      var tm_zone = HEAP32[(((tm)+(40))>>2)];
  
      var date = {
        tm_sec: HEAP32[((tm)>>2)],
        tm_min: HEAP32[(((tm)+(4))>>2)],
        tm_hour: HEAP32[(((tm)+(8))>>2)],
        tm_mday: HEAP32[(((tm)+(12))>>2)],
        tm_mon: HEAP32[(((tm)+(16))>>2)],
        tm_year: HEAP32[(((tm)+(20))>>2)],
        tm_wday: HEAP32[(((tm)+(24))>>2)],
        tm_yday: HEAP32[(((tm)+(28))>>2)],
        tm_isdst: HEAP32[(((tm)+(32))>>2)],
        tm_gmtoff: HEAP32[(((tm)+(36))>>2)],
        tm_zone: tm_zone ? UTF8ToString(tm_zone) : ''
      };
  
      var pattern = UTF8ToString(format);
  
      // expand format
      var EXPANSION_RULES_1 = {
        '%c': '%a %b %d %H:%M:%S %Y',     // Replaced by the locale's appropriate date and time representation - e.g., Mon Aug  3 14:02:01 2013
        '%D': '%m/%d/%y',                 // Equivalent to %m / %d / %y
        '%F': '%Y-%m-%d',                 // Equivalent to %Y - %m - %d
        '%h': '%b',                       // Equivalent to %b
        '%r': '%I:%M:%S %p',              // Replaced by the time in a.m. and p.m. notation
        '%R': '%H:%M',                    // Replaced by the time in 24-hour notation
        '%T': '%H:%M:%S',                 // Replaced by the time
        '%x': '%m/%d/%y',                 // Replaced by the locale's appropriate date representation
        '%X': '%H:%M:%S',                 // Replaced by the locale's appropriate time representation
        // Modified Conversion Specifiers
        '%Ec': '%c',                      // Replaced by the locale's alternative appropriate date and time representation.
        '%EC': '%C',                      // Replaced by the name of the base year (period) in the locale's alternative representation.
        '%Ex': '%m/%d/%y',                // Replaced by the locale's alternative date representation.
        '%EX': '%H:%M:%S',                // Replaced by the locale's alternative time representation.
        '%Ey': '%y',                      // Replaced by the offset from %EC (year only) in the locale's alternative representation.
        '%EY': '%Y',                      // Replaced by the full alternative year representation.
        '%Od': '%d',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading zeros if there is any alternative symbol for zero; otherwise, with leading <space> characters.
        '%Oe': '%e',                      // Replaced by the day of the month, using the locale's alternative numeric symbols, filled as needed with leading <space> characters.
        '%OH': '%H',                      // Replaced by the hour (24-hour clock) using the locale's alternative numeric symbols.
        '%OI': '%I',                      // Replaced by the hour (12-hour clock) using the locale's alternative numeric symbols.
        '%Om': '%m',                      // Replaced by the month using the locale's alternative numeric symbols.
        '%OM': '%M',                      // Replaced by the minutes using the locale's alternative numeric symbols.
        '%OS': '%S',                      // Replaced by the seconds using the locale's alternative numeric symbols.
        '%Ou': '%u',                      // Replaced by the weekday as a number in the locale's alternative representation (Monday=1).
        '%OU': '%U',                      // Replaced by the week number of the year (Sunday as the first day of the week, rules corresponding to %U ) using the locale's alternative numeric symbols.
        '%OV': '%V',                      // Replaced by the week number of the year (Monday as the first day of the week, rules corresponding to %V ) using the locale's alternative numeric symbols.
        '%Ow': '%w',                      // Replaced by the number of the weekday (Sunday=0) using the locale's alternative numeric symbols.
        '%OW': '%W',                      // Replaced by the week number of the year (Monday as the first day of the week) using the locale's alternative numeric symbols.
        '%Oy': '%y',                      // Replaced by the year (offset from %C ) using the locale's alternative numeric symbols.
      };
      for (var rule in EXPANSION_RULES_1) {
        pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_1[rule]);
      }
  
      var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
      function leadingSomething(value, digits, character) {
        var str = typeof value === 'number' ? value.toString() : (value || '');
        while (str.length < digits) {
          str = character[0]+str;
        }
        return str;
      }
  
      function leadingNulls(value, digits) {
        return leadingSomething(value, digits, '0');
      }
  
      function compareByDay(date1, date2) {
        function sgn(value) {
          return value < 0 ? -1 : (value > 0 ? 1 : 0);
        }
  
        var compare;
        if ((compare = sgn(date1.getFullYear()-date2.getFullYear())) === 0) {
          if ((compare = sgn(date1.getMonth()-date2.getMonth())) === 0) {
            compare = sgn(date1.getDate()-date2.getDate());
          }
        }
        return compare;
      }
  
      function getFirstWeekStartDate(janFourth) {
          switch (janFourth.getDay()) {
            case 0: // Sunday
              return new Date(janFourth.getFullYear()-1, 11, 29);
            case 1: // Monday
              return janFourth;
            case 2: // Tuesday
              return new Date(janFourth.getFullYear(), 0, 3);
            case 3: // Wednesday
              return new Date(janFourth.getFullYear(), 0, 2);
            case 4: // Thursday
              return new Date(janFourth.getFullYear(), 0, 1);
            case 5: // Friday
              return new Date(janFourth.getFullYear()-1, 11, 31);
            case 6: // Saturday
              return new Date(janFourth.getFullYear()-1, 11, 30);
          }
      }
  
      function getWeekBasedYear(date) {
          var thisDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
          var janFourthNextYear = new Date(thisDate.getFullYear()+1, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
            // this date is after the start of the first week of this year
            if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
              return thisDate.getFullYear()+1;
            } else {
              return thisDate.getFullYear();
            }
          } else {
            return thisDate.getFullYear()-1;
          }
      }
  
      var EXPANSION_RULES_2 = {
        '%a': function(date) {
          return WEEKDAYS[date.tm_wday].substring(0,3);
        },
        '%A': function(date) {
          return WEEKDAYS[date.tm_wday];
        },
        '%b': function(date) {
          return MONTHS[date.tm_mon].substring(0,3);
        },
        '%B': function(date) {
          return MONTHS[date.tm_mon];
        },
        '%C': function(date) {
          var year = date.tm_year+1900;
          return leadingNulls((year/100)|0,2);
        },
        '%d': function(date) {
          return leadingNulls(date.tm_mday, 2);
        },
        '%e': function(date) {
          return leadingSomething(date.tm_mday, 2, ' ');
        },
        '%g': function(date) {
          // %g, %G, and %V give values according to the ISO 8601:2000 standard week-based year.
          // In this system, weeks begin on a Monday and week 1 of the year is the week that includes
          // January 4th, which is also the week that includes the first Thursday of the year, and
          // is also the first week that contains at least four days in the year.
          // If the first Monday of January is the 2nd, 3rd, or 4th, the preceding days are part of
          // the last week of the preceding year; thus, for Saturday 2nd January 1999,
          // %G is replaced by 1998 and %V is replaced by 53. If December 29th, 30th,
          // or 31st is a Monday, it and any following days are part of week 1 of the following year.
          // Thus, for Tuesday 30th December 1997, %G is replaced by 1998 and %V is replaced by 01.
  
          return getWeekBasedYear(date).toString().substring(2);
        },
        '%G': function(date) {
          return getWeekBasedYear(date);
        },
        '%H': function(date) {
          return leadingNulls(date.tm_hour, 2);
        },
        '%I': function(date) {
          var twelveHour = date.tm_hour;
          if (twelveHour == 0) twelveHour = 12;
          else if (twelveHour > 12) twelveHour -= 12;
          return leadingNulls(twelveHour, 2);
        },
        '%j': function(date) {
          // Day of the year (001-366)
          return leadingNulls(date.tm_mday+__arraySum(__isLeapYear(date.tm_year+1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon-1), 3);
        },
        '%m': function(date) {
          return leadingNulls(date.tm_mon+1, 2);
        },
        '%M': function(date) {
          return leadingNulls(date.tm_min, 2);
        },
        '%n': function() {
          return '\n';
        },
        '%p': function(date) {
          if (date.tm_hour >= 0 && date.tm_hour < 12) {
            return 'AM';
          } else {
            return 'PM';
          }
        },
        '%S': function(date) {
          return leadingNulls(date.tm_sec, 2);
        },
        '%t': function() {
          return '\t';
        },
        '%u': function(date) {
          return date.tm_wday || 7;
        },
        '%U': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53].
          // The first Sunday of January is the first day of week 1;
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year+1900, 0, 1);
          var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7-janFirst.getDay());
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Sunday?
          if (compareByDay(firstSunday, endDate) < 0) {
            // calculate difference in days between first Sunday and endDate
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstSundayUntilEndJanuary = 31-firstSunday.getDate();
            var days = firstSundayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
  
          return compareByDay(firstSunday, janFirst) === 0 ? '01': '00';
        },
        '%V': function(date) {
          // Replaced by the week number of the year (Monday as the first day of the week)
          // as a decimal number [01,53]. If the week containing 1 January has four
          // or more days in the new year, then it is considered week 1.
          // Otherwise, it is the last week of the previous year, and the next week is week 1.
          // Both January 4th and the first Thursday of January are always in week 1. [ tm_year, tm_wday, tm_yday]
          var janFourthThisYear = new Date(date.tm_year+1900, 0, 4);
          var janFourthNextYear = new Date(date.tm_year+1901, 0, 4);
  
          var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
          var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
  
          var endDate = __addDays(new Date(date.tm_year+1900, 0, 1), date.tm_yday);
  
          if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
            // if given date is before this years first week, then it belongs to the 53rd week of last year
            return '53';
          }
  
          if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
            // if given date is after next years first week, then it belongs to the 01th week of next year
            return '01';
          }
  
          // given date is in between CW 01..53 of this calendar year
          var daysDifference;
          if (firstWeekStartThisYear.getFullYear() < date.tm_year+1900) {
            // first CW of this year starts last year
            daysDifference = date.tm_yday+32-firstWeekStartThisYear.getDate()
          } else {
            // first CW of this year starts this year
            daysDifference = date.tm_yday+1-firstWeekStartThisYear.getDate();
          }
          return leadingNulls(Math.ceil(daysDifference/7), 2);
        },
        '%w': function(date) {
          return date.tm_wday;
        },
        '%W': function(date) {
          // Replaced by the week number of the year as a decimal number [00,53].
          // The first Monday of January is the first day of week 1;
          // days in the new year before this are in week 0. [ tm_year, tm_wday, tm_yday]
          var janFirst = new Date(date.tm_year, 0, 1);
          var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7-janFirst.getDay()+1);
          var endDate = new Date(date.tm_year+1900, date.tm_mon, date.tm_mday);
  
          // is target date after the first Monday?
          if (compareByDay(firstMonday, endDate) < 0) {
            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth()-1)-31;
            var firstMondayUntilEndJanuary = 31-firstMonday.getDate();
            var days = firstMondayUntilEndJanuary+februaryFirstUntilEndMonth+endDate.getDate();
            return leadingNulls(Math.ceil(days/7), 2);
          }
          return compareByDay(firstMonday, janFirst) === 0 ? '01': '00';
        },
        '%y': function(date) {
          // Replaced by the last two digits of the year as a decimal number [00,99]. [ tm_year]
          return (date.tm_year+1900).toString().substring(2);
        },
        '%Y': function(date) {
          // Replaced by the year as a decimal number (for example, 1997). [ tm_year]
          return date.tm_year+1900;
        },
        '%z': function(date) {
          // Replaced by the offset from UTC in the ISO 8601:2000 standard format ( +hhmm or -hhmm ).
          // For example, "-0430" means 4 hours 30 minutes behind UTC (west of Greenwich).
          var off = date.tm_gmtoff;
          var ahead = off >= 0;
          off = Math.abs(off) / 60;
          // convert from minutes into hhmm format (which means 60 minutes = 100 units)
          off = (off / 60)*100 + (off % 60);
          return (ahead ? '+' : '-') + String("0000" + off).slice(-4);
        },
        '%Z': function(date) {
          return date.tm_zone;
        },
        '%%': function() {
          return '%';
        }
      };
      for (var rule in EXPANSION_RULES_2) {
        if (pattern.includes(rule)) {
          pattern = pattern.replace(new RegExp(rule, 'g'), EXPANSION_RULES_2[rule](date));
        }
      }
  
      var bytes = intArrayFromString(pattern, false);
      if (bytes.length > maxsize) {
        return 0;
      }
  
      writeArrayToMemory(bytes, s);
      return bytes.length-1;
    }

  function _strftime_l(s, maxsize, format, tm) {
      return _strftime(s, maxsize, format, tm); // no locale support yet
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)] = ret;
      }
      return ret;
    }



  function runAndAbortIfError(func) {
      try {
        return func();
      } catch (e) {
        abort(e);
      }
    }
  var Asyncify={State:{Normal:0,Unwinding:1,Rewinding:2},state:0,StackSize:4096,currData:null,handleSleepReturnValue:0,exportCallStack:[],callStackNameToId:{},callStackIdToName:{},callStackId:0,afterUnwind:null,asyncFinalizers:[],sleepCallbacks:[],getCallStackId:function(funcName) {
        var id = Asyncify.callStackNameToId[funcName];
        if (id === undefined) {
          id = Asyncify.callStackId++;
          Asyncify.callStackNameToId[funcName] = id;
          Asyncify.callStackIdToName[id] = funcName;
        }
        return id;
      },instrumentWasmExports:function(exports) {
        var ret = {};
        for (var x in exports) {
          (function(x) {
            var original = exports[x];
            if (typeof original === 'function') {
              ret[x] = function() {
                Asyncify.exportCallStack.push(x);
                try {
                  return original.apply(null, arguments);
                } finally {
                  if (ABORT) return;
                  var y = Asyncify.exportCallStack.pop();
                  assert(y === x);
                  Asyncify.maybeStopUnwind();
                }
              };
            } else {
              ret[x] = original;
            }
          })(x);
        }
        return ret;
      },maybeStopUnwind:function() {
        if (Asyncify.currData &&
            Asyncify.state === Asyncify.State.Unwinding &&
            Asyncify.exportCallStack.length === 0) {
          // We just finished unwinding.
          Asyncify.state = Asyncify.State.Normal;
          runAndAbortIfError(Module['_asyncify_stop_unwind']);
          if (typeof Fibers !== 'undefined') {
            Fibers.trampoline();
          }
          if (Asyncify.afterUnwind) {
            Asyncify.afterUnwind();
            Asyncify.afterUnwind = null;
          }
        }
      },allocateData:function() {
        // An asyncify data structure has three fields:
        //  0  current stack pos
        //  4  max stack pos
        //  8  id of function at bottom of the call stack (callStackIdToName[id] == name of js function)
        //
        // The Asyncify ABI only interprets the first two fields, the rest is for the runtime.
        // We also embed a stack in the same memory region here, right next to the structure.
        // This struct is also defined as asyncify_data_t in emscripten/fiber.h
        var ptr = _malloc(12 + Asyncify.StackSize);
        Asyncify.setDataHeader(ptr, ptr + 12, Asyncify.StackSize);
        Asyncify.setDataRewindFunc(ptr);
        return ptr;
      },setDataHeader:function(ptr, stack, stackSize) {
        HEAP32[((ptr)>>2)] = stack;
        HEAP32[(((ptr)+(4))>>2)] = stack + stackSize;
      },setDataRewindFunc:function(ptr) {
        var bottomOfCallStack = Asyncify.exportCallStack[0];
        var rewindId = Asyncify.getCallStackId(bottomOfCallStack);
        HEAP32[(((ptr)+(8))>>2)] = rewindId;
      },getDataRewindFunc:function(ptr) {
        var id = HEAP32[(((ptr)+(8))>>2)];
        var name = Asyncify.callStackIdToName[id];
        var func = Module['asm'][name];
        return func;
      },handleSleep:function(startAsync) {
        if (ABORT) return;
        noExitRuntime = true;
        if (Asyncify.state === Asyncify.State.Normal) {
          // Prepare to sleep. Call startAsync, and see what happens:
          // if the code decided to call our callback synchronously,
          // then no async operation was in fact begun, and we don't
          // need to do anything.
          var reachedCallback = false;
          var reachedAfterCallback = false;
          startAsync(function(handleSleepReturnValue) {
            if (ABORT) return;
            Asyncify.handleSleepReturnValue = handleSleepReturnValue || 0;
            reachedCallback = true;
            if (!reachedAfterCallback) {
              // We are happening synchronously, so no need for async.
              return;
            }
            Asyncify.state = Asyncify.State.Rewinding;
            runAndAbortIfError(function() { Module['_asyncify_start_rewind'](Asyncify.currData) });
            if (typeof Browser !== 'undefined' && Browser.mainLoop.func) {
              Browser.mainLoop.resume();
            }
            var start = Asyncify.getDataRewindFunc(Asyncify.currData);
            var asyncWasmReturnValue = start();
            if (!Asyncify.currData) {
              // All asynchronous execution has finished.
              // `asyncWasmReturnValue` now contains the final
              // return value of the exported async WASM function.
              //
              // Note: `asyncWasmReturnValue` is distinct from
              // `Asyncify.handleSleepReturnValue`.
              // `Asyncify.handleSleepReturnValue` contains the return
              // value of the last C function to have executed
              // `Asyncify.handleSleep()`, where as `asyncWasmReturnValue`
              // contains the return value of the exported WASM function
              // that may have called C functions that
              // call `Asyncify.handleSleep()`.
              var asyncFinalizers = Asyncify.asyncFinalizers;
              Asyncify.asyncFinalizers = [];
              asyncFinalizers.forEach(function(func) {
                func(asyncWasmReturnValue);
              });
            }
          });
          reachedAfterCallback = true;
          if (!reachedCallback) {
            // A true async operation was begun; start a sleep.
            Asyncify.state = Asyncify.State.Unwinding;
            // TODO: reuse, don't alloc/free every sleep
            Asyncify.currData = Asyncify.allocateData();
            runAndAbortIfError(function() { Module['_asyncify_start_unwind'](Asyncify.currData) });
            if (typeof Browser !== 'undefined' && Browser.mainLoop.func) {
              Browser.mainLoop.pause();
            }
          }
        } else if (Asyncify.state === Asyncify.State.Rewinding) {
          // Stop a resume.
          Asyncify.state = Asyncify.State.Normal;
          runAndAbortIfError(Module['_asyncify_stop_rewind']);
          _free(Asyncify.currData);
          Asyncify.currData = null;
          // Call all sleep callbacks now that the sleep-resume is all done.
          Asyncify.sleepCallbacks.forEach(function(func) {
            func();
          });
        } else {
          abort('invalid state: ' + Asyncify.state);
        }
        return Asyncify.handleSleepReturnValue;
      },handleAsync:function(startAsync) {
        return Asyncify.handleSleep(function(wakeUp) {
          // TODO: add error handling as a second param when handleSleep implements it.
          startAsync().then(wakeUp);
        });
      }};
var FSNode = /** @constructor */ function(parent, name, mode, rdev) {
    if (!parent) {
      parent = this;  // root node sets parent to itself
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
  };
  var readMode = 292/*292*/ | 73/*73*/;
  var writeMode = 146/*146*/;
  Object.defineProperties(FSNode.prototype, {
   read: {
    get: /** @this{FSNode} */function() {
     return (this.mode & readMode) === readMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= readMode : this.mode &= ~readMode;
    }
   },
   write: {
    get: /** @this{FSNode} */function() {
     return (this.mode & writeMode) === writeMode;
    },
    set: /** @this{FSNode} */function(val) {
     val ? this.mode |= writeMode : this.mode &= ~writeMode;
    }
   },
   isFolder: {
    get: /** @this{FSNode} */function() {
     return FS.isDir(this.mode);
    }
   },
   isDevice: {
    get: /** @this{FSNode} */function() {
     return FS.isChrdev(this.mode);
    }
   }
  });
  FS.FSNode = FSNode;
  FS.staticInit();Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createDevice"] = FS.createDevice;Module["FS_unlink"] = FS.unlink;;
Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas) { Browser.requestFullscreen(lockPointer, resizeCanvas) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
var GLctx;;
MONO.export_functions (Module);;
BINDING.export_functions (Module);;
var ASSERTIONS = false;



/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


var asmLibraryArg = {
  "__assert_fail": ___assert_fail,
  "__clock_gettime": ___clock_gettime,
  "__cxa_allocate_exception": ___cxa_allocate_exception,
  "__cxa_atexit": ___cxa_atexit,
  "__cxa_begin_catch": ___cxa_begin_catch,
  "__cxa_end_catch": ___cxa_end_catch,
  "__cxa_find_matching_catch_2": ___cxa_find_matching_catch_2,
  "__cxa_find_matching_catch_3": ___cxa_find_matching_catch_3,
  "__cxa_free_exception": ___cxa_free_exception,
  "__cxa_rethrow": ___cxa_rethrow,
  "__cxa_throw": ___cxa_throw,
  "__cxa_uncaught_exceptions": ___cxa_uncaught_exceptions,
  "__resumeException": ___resumeException,
  "__sys_access": ___sys_access,
  "__sys_chdir": ___sys_chdir,
  "__sys_chmod": ___sys_chmod,
  "__sys_connect": ___sys_connect,
  "__sys_fadvise64_64": ___sys_fadvise64_64,
  "__sys_fchmod": ___sys_fchmod,
  "__sys_fcntl64": ___sys_fcntl64,
  "__sys_fstat64": ___sys_fstat64,
  "__sys_fstatfs64": ___sys_fstatfs64,
  "__sys_ftruncate64": ___sys_ftruncate64,
  "__sys_getcwd": ___sys_getcwd,
  "__sys_getdents64": ___sys_getdents64,
  "__sys_getpid": ___sys_getpid,
  "__sys_getrusage": ___sys_getrusage,
  "__sys_ioctl": ___sys_ioctl,
  "__sys_link": ___sys_link,
  "__sys_lstat64": ___sys_lstat64,
  "__sys_madvise1": ___sys_madvise1,
  "__sys_mkdir": ___sys_mkdir,
  "__sys_mmap2": ___sys_mmap2,
  "__sys_msync": ___sys_msync,
  "__sys_munmap": ___sys_munmap,
  "__sys_open": ___sys_open,
  "__sys_readlink": ___sys_readlink,
  "__sys_recvfrom": ___sys_recvfrom,
  "__sys_rename": ___sys_rename,
  "__sys_rmdir": ___sys_rmdir,
  "__sys_sendto": ___sys_sendto,
  "__sys_setsockopt": ___sys_setsockopt,
  "__sys_shutdown": ___sys_shutdown,
  "__sys_socket": ___sys_socket,
  "__sys_stat64": ___sys_stat64,
  "__sys_symlink": ___sys_symlink,
  "__sys_unlink": ___sys_unlink,
  "__sys_utimensat": ___sys_utimensat,
  "abort": _abort,
  "clock_getres": _clock_getres,
  "clock_gettime": _clock_gettime,
  "compile_function": compile_function,
  "difftime": _difftime,
  "dotnet_browser_entropy": _dotnet_browser_entropy,
  "emscripten_asm_const_int": _emscripten_asm_const_int,
  "emscripten_async_wget_data": _emscripten_async_wget_data,
  "emscripten_get_heap_max": _emscripten_get_heap_max,
  "emscripten_memcpy_big": _emscripten_memcpy_big,
  "emscripten_resize_heap": _emscripten_resize_heap,
  "emscripten_thread_sleep": _emscripten_thread_sleep,
  "emscripten_webgl_create_context": _emscripten_webgl_create_context,
  "emscripten_webgl_init_context_attributes": _emscripten_webgl_init_context_attributes,
  "emscripten_webgl_make_context_current": _emscripten_webgl_make_context_current,
  "emscripten_wget_data": _emscripten_wget_data,
  "environ_get": _environ_get,
  "environ_sizes_get": _environ_sizes_get,
  "exit": _exit,
  "fd_close": _fd_close,
  "fd_fdstat_get": _fd_fdstat_get,
  "fd_pread": _fd_pread,
  "fd_pwrite": _fd_pwrite,
  "fd_read": _fd_read,
  "fd_seek": _fd_seek,
  "fd_sync": _fd_sync,
  "fd_write": _fd_write,
  "flock": _flock,
  "gai_strerror": _gai_strerror,
  "getTempRet0": _getTempRet0,
  "gettimeofday": _gettimeofday,
  "glActiveTexture": _glActiveTexture,
  "glAttachShader": _glAttachShader,
  "glBindBuffer": _glBindBuffer,
  "glBindFramebuffer": _glBindFramebuffer,
  "glBindTexture": _glBindTexture,
  "glBindVertexArray": _glBindVertexArray,
  "glBlitFramebuffer": _glBlitFramebuffer,
  "glBufferData": _glBufferData,
  "glClear": _glClear,
  "glClearColor": _glClearColor,
  "glCompileShader": _glCompileShader,
  "glCreateProgram": _glCreateProgram,
  "glCreateShader": _glCreateShader,
  "glDeleteShader": _glDeleteShader,
  "glDrawElements": _glDrawElements,
  "glEnableVertexAttribArray": _glEnableVertexAttribArray,
  "glFinish": _glFinish,
  "glFramebufferTexture2D": _glFramebufferTexture2D,
  "glGenBuffers": _glGenBuffers,
  "glGenFramebuffers": _glGenFramebuffers,
  "glGenTextures": _glGenTextures,
  "glGenVertexArrays": _glGenVertexArrays,
  "glGetProgramInfoLog": _glGetProgramInfoLog,
  "glGetProgramiv": _glGetProgramiv,
  "glGetShaderInfoLog": _glGetShaderInfoLog,
  "glGetShaderiv": _glGetShaderiv,
  "glGetUniformLocation": _glGetUniformLocation,
  "glIsProgram": _glIsProgram,
  "glIsShader": _glIsShader,
  "glLinkProgram": _glLinkProgram,
  "glShaderSource": _glShaderSource,
  "glTexImage2D": _glTexImage2D,
  "glTexParameteri": _glTexParameteri,
  "glUniform1f": _glUniform1f,
  "glUniform1i": _glUniform1i,
  "glUniform2f": _glUniform2f,
  "glUniform2i": _glUniform2i,
  "glUseProgram": _glUseProgram,
  "glVertexAttribPointer": _glVertexAttribPointer,
  "glViewport": _glViewport,
  "gmtime_r": _gmtime_r,
  "invoke_diii": invoke_diii,
  "invoke_fiii": invoke_fiii,
  "invoke_i": invoke_i,
  "invoke_ii": invoke_ii,
  "invoke_iii": invoke_iii,
  "invoke_iiii": invoke_iiii,
  "invoke_iiiii": invoke_iiiii,
  "invoke_iiiiii": invoke_iiiiii,
  "invoke_iiiiiii": invoke_iiiiiii,
  "invoke_iiiiiiii": invoke_iiiiiiii,
  "invoke_iiiiiiiiiii": invoke_iiiiiiiiiii,
  "invoke_iiiiiiiiiiii": invoke_iiiiiiiiiiii,
  "invoke_iiiiiiiiiiiii": invoke_iiiiiiiiiiiii,
  "invoke_jiiii": invoke_jiiii,
  "invoke_v": invoke_v,
  "invoke_vi": invoke_vi,
  "invoke_vii": invoke_vii,
  "invoke_viii": invoke_viii,
  "invoke_viiii": invoke_viiii,
  "invoke_viiiiiii": invoke_viiiiiii,
  "invoke_viiiiiiiiii": invoke_viiiiiiiiii,
  "invoke_viiiiiiiiiiiiiii": invoke_viiiiiiiiiiiiiii,
  "llvm_eh_typeid_for": _llvm_eh_typeid_for,
  "localtime_r": _localtime_r,
  "mono_set_timeout": _mono_set_timeout,
  "mono_wasm_add_event_listener": _mono_wasm_add_event_listener,
  "mono_wasm_asm_loaded": _mono_wasm_asm_loaded,
  "mono_wasm_create_cs_owned_object": _mono_wasm_create_cs_owned_object,
  "mono_wasm_fire_debugger_agent_message": _mono_wasm_fire_debugger_agent_message,
  "mono_wasm_get_by_index": _mono_wasm_get_by_index,
  "mono_wasm_get_global_object": _mono_wasm_get_global_object,
  "mono_wasm_get_object_property": _mono_wasm_get_object_property,
  "mono_wasm_invoke_js_blazor": _mono_wasm_invoke_js_blazor,
  "mono_wasm_invoke_js_marshalled": _mono_wasm_invoke_js_marshalled,
  "mono_wasm_invoke_js_unmarshalled": _mono_wasm_invoke_js_unmarshalled,
  "mono_wasm_invoke_js_with_args": _mono_wasm_invoke_js_with_args,
  "mono_wasm_release_cs_owned_object": _mono_wasm_release_cs_owned_object,
  "mono_wasm_remove_event_listener": _mono_wasm_remove_event_listener,
  "mono_wasm_set_by_index": _mono_wasm_set_by_index,
  "mono_wasm_set_object_property": _mono_wasm_set_object_property,
  "mono_wasm_typed_array_copy_from": _mono_wasm_typed_array_copy_from,
  "mono_wasm_typed_array_copy_to": _mono_wasm_typed_array_copy_to,
  "mono_wasm_typed_array_from": _mono_wasm_typed_array_from,
  "mono_wasm_typed_array_to_array": _mono_wasm_typed_array_to_array,
  "schedule_background_exec": _schedule_background_exec,
  "strftime": _strftime,
  "strftime_l": _strftime_l,
  "time": _time,
  "tzset": _tzset
};
var asm = createWasm();
/** @type {function(...*):?} */
var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
  return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["__wasm_call_ctors"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _free = Module["_free"] = function() {
  return (_free = Module["_free"] = Module["asm"]["free"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _malloc = Module["_malloc"] = function() {
  return (_malloc = Module["_malloc"] = Module["asm"]["malloc"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _memset = Module["_memset"] = function() {
  return (_memset = Module["_memset"] = Module["asm"]["memset"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_register_root = Module["_mono_wasm_register_root"] = function() {
  return (_mono_wasm_register_root = Module["_mono_wasm_register_root"] = Module["asm"]["mono_wasm_register_root"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_deregister_root = Module["_mono_wasm_deregister_root"] = function() {
  return (_mono_wasm_deregister_root = Module["_mono_wasm_deregister_root"] = Module["asm"]["mono_wasm_deregister_root"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_add_assembly = Module["_mono_wasm_add_assembly"] = function() {
  return (_mono_wasm_add_assembly = Module["_mono_wasm_add_assembly"] = Module["asm"]["mono_wasm_add_assembly"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_add_satellite_assembly = Module["_mono_wasm_add_satellite_assembly"] = function() {
  return (_mono_wasm_add_satellite_assembly = Module["_mono_wasm_add_satellite_assembly"] = Module["asm"]["mono_wasm_add_satellite_assembly"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_setenv = Module["_mono_wasm_setenv"] = function() {
  return (_mono_wasm_setenv = Module["_mono_wasm_setenv"] = Module["asm"]["mono_wasm_setenv"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_register_bundled_satellite_assemblies = Module["_mono_wasm_register_bundled_satellite_assemblies"] = function() {
  return (_mono_wasm_register_bundled_satellite_assemblies = Module["_mono_wasm_register_bundled_satellite_assemblies"] = Module["asm"]["mono_wasm_register_bundled_satellite_assemblies"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_load_runtime = Module["_mono_wasm_load_runtime"] = function() {
  return (_mono_wasm_load_runtime = Module["_mono_wasm_load_runtime"] = Module["asm"]["mono_wasm_load_runtime"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_assembly_load = Module["_mono_wasm_assembly_load"] = function() {
  return (_mono_wasm_assembly_load = Module["_mono_wasm_assembly_load"] = Module["asm"]["mono_wasm_assembly_load"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_find_corlib_class = Module["_mono_wasm_find_corlib_class"] = function() {
  return (_mono_wasm_find_corlib_class = Module["_mono_wasm_find_corlib_class"] = Module["asm"]["mono_wasm_find_corlib_class"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_assembly_find_class = Module["_mono_wasm_assembly_find_class"] = function() {
  return (_mono_wasm_assembly_find_class = Module["_mono_wasm_assembly_find_class"] = Module["asm"]["mono_wasm_assembly_find_class"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_assembly_find_method = Module["_mono_wasm_assembly_find_method"] = function() {
  return (_mono_wasm_assembly_find_method = Module["_mono_wasm_assembly_find_method"] = Module["asm"]["mono_wasm_assembly_find_method"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_get_delegate_invoke = Module["_mono_wasm_get_delegate_invoke"] = function() {
  return (_mono_wasm_get_delegate_invoke = Module["_mono_wasm_get_delegate_invoke"] = Module["asm"]["mono_wasm_get_delegate_invoke"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_box_primitive = Module["_mono_wasm_box_primitive"] = function() {
  return (_mono_wasm_box_primitive = Module["_mono_wasm_box_primitive"] = Module["asm"]["mono_wasm_box_primitive"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_invoke_method = Module["_mono_wasm_invoke_method"] = function() {
  return (_mono_wasm_invoke_method = Module["_mono_wasm_invoke_method"] = Module["asm"]["mono_wasm_invoke_method"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_assembly_get_entry_point = Module["_mono_wasm_assembly_get_entry_point"] = function() {
  return (_mono_wasm_assembly_get_entry_point = Module["_mono_wasm_assembly_get_entry_point"] = Module["asm"]["mono_wasm_assembly_get_entry_point"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_get_utf8 = Module["_mono_wasm_string_get_utf8"] = function() {
  return (_mono_wasm_string_get_utf8 = Module["_mono_wasm_string_get_utf8"] = Module["asm"]["mono_wasm_string_get_utf8"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_convert = Module["_mono_wasm_string_convert"] = function() {
  return (_mono_wasm_string_convert = Module["_mono_wasm_string_convert"] = Module["asm"]["mono_wasm_string_convert"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_from_js = Module["_mono_wasm_string_from_js"] = function() {
  return (_mono_wasm_string_from_js = Module["_mono_wasm_string_from_js"] = Module["asm"]["mono_wasm_string_from_js"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_from_utf16 = Module["_mono_wasm_string_from_utf16"] = function() {
  return (_mono_wasm_string_from_utf16 = Module["_mono_wasm_string_from_utf16"] = Module["asm"]["mono_wasm_string_from_utf16"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_get_obj_type = Module["_mono_wasm_get_obj_type"] = function() {
  return (_mono_wasm_get_obj_type = Module["_mono_wasm_get_obj_type"] = Module["asm"]["mono_wasm_get_obj_type"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_try_unbox_primitive_and_get_type = Module["_mono_wasm_try_unbox_primitive_and_get_type"] = function() {
  return (_mono_wasm_try_unbox_primitive_and_get_type = Module["_mono_wasm_try_unbox_primitive_and_get_type"] = Module["asm"]["mono_wasm_try_unbox_primitive_and_get_type"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_unbox_int = Module["_mono_unbox_int"] = function() {
  return (_mono_unbox_int = Module["_mono_unbox_int"] = Module["asm"]["mono_unbox_int"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_array_length = Module["_mono_wasm_array_length"] = function() {
  return (_mono_wasm_array_length = Module["_mono_wasm_array_length"] = Module["asm"]["mono_wasm_array_length"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_array_get = Module["_mono_wasm_array_get"] = function() {
  return (_mono_wasm_array_get = Module["_mono_wasm_array_get"] = Module["asm"]["mono_wasm_array_get"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_obj_array_new = Module["_mono_wasm_obj_array_new"] = function() {
  return (_mono_wasm_obj_array_new = Module["_mono_wasm_obj_array_new"] = Module["asm"]["mono_wasm_obj_array_new"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_obj_array_set = Module["_mono_wasm_obj_array_set"] = function() {
  return (_mono_wasm_obj_array_set = Module["_mono_wasm_obj_array_set"] = Module["asm"]["mono_wasm_obj_array_set"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_array_new = Module["_mono_wasm_string_array_new"] = function() {
  return (_mono_wasm_string_array_new = Module["_mono_wasm_string_array_new"] = Module["asm"]["mono_wasm_string_array_new"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_exec_regression = Module["_mono_wasm_exec_regression"] = function() {
  return (_mono_wasm_exec_regression = Module["_mono_wasm_exec_regression"] = Module["asm"]["mono_wasm_exec_regression"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_exit = Module["_mono_wasm_exit"] = function() {
  return (_mono_wasm_exit = Module["_mono_wasm_exit"] = Module["asm"]["mono_wasm_exit"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_set_main_args = Module["_mono_wasm_set_main_args"] = function() {
  return (_mono_wasm_set_main_args = Module["_mono_wasm_set_main_args"] = Module["asm"]["mono_wasm_set_main_args"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_strdup = Module["_mono_wasm_strdup"] = function() {
  return (_mono_wasm_strdup = Module["_mono_wasm_strdup"] = Module["asm"]["mono_wasm_strdup"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_parse_runtime_options = Module["_mono_wasm_parse_runtime_options"] = function() {
  return (_mono_wasm_parse_runtime_options = Module["_mono_wasm_parse_runtime_options"] = Module["asm"]["mono_wasm_parse_runtime_options"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_enable_on_demand_gc = Module["_mono_wasm_enable_on_demand_gc"] = function() {
  return (_mono_wasm_enable_on_demand_gc = Module["_mono_wasm_enable_on_demand_gc"] = Module["asm"]["mono_wasm_enable_on_demand_gc"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_intern_string = Module["_mono_wasm_intern_string"] = function() {
  return (_mono_wasm_intern_string = Module["_mono_wasm_intern_string"] = Module["asm"]["mono_wasm_intern_string"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_string_get_data = Module["_mono_wasm_string_get_data"] = function() {
  return (_mono_wasm_string_get_data = Module["_mono_wasm_string_get_data"] = Module["asm"]["mono_wasm_string_get_data"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_typed_array_new = Module["_mono_wasm_typed_array_new"] = function() {
  return (_mono_wasm_typed_array_new = Module["_mono_wasm_typed_array_new"] = Module["asm"]["mono_wasm_typed_array_new"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_unbox_enum = Module["_mono_wasm_unbox_enum"] = function() {
  return (_mono_wasm_unbox_enum = Module["_mono_wasm_unbox_enum"] = Module["asm"]["mono_wasm_unbox_enum"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_set_is_debugger_attached = Module["_mono_wasm_set_is_debugger_attached"] = function() {
  return (_mono_wasm_set_is_debugger_attached = Module["_mono_wasm_set_is_debugger_attached"] = Module["asm"]["mono_wasm_set_is_debugger_attached"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_send_dbg_command_with_parms = Module["_mono_wasm_send_dbg_command_with_parms"] = function() {
  return (_mono_wasm_send_dbg_command_with_parms = Module["_mono_wasm_send_dbg_command_with_parms"] = Module["asm"]["mono_wasm_send_dbg_command_with_parms"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_send_dbg_command = Module["_mono_wasm_send_dbg_command"] = function() {
  return (_mono_wasm_send_dbg_command = Module["_mono_wasm_send_dbg_command"] = Module["asm"]["mono_wasm_send_dbg_command"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var ___errno_location = Module["___errno_location"] = function() {
  return (___errno_location = Module["___errno_location"] = Module["asm"]["__errno_location"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _putchar = Module["_putchar"] = function() {
  return (_putchar = Module["_putchar"] = Module["asm"]["putchar"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
  return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_get_base = Module["_emscripten_stack_get_base"] = function() {
  return (_emscripten_stack_get_base = Module["_emscripten_stack_get_base"] = Module["asm"]["emscripten_stack_get_base"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_background_exec = Module["_mono_background_exec"] = function() {
  return (_mono_background_exec = Module["_mono_background_exec"] = Module["asm"]["mono_background_exec"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _htons = Module["_htons"] = function() {
  return (_htons = Module["_htons"] = Module["asm"]["htons"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_get_icudt_name = Module["_mono_wasm_get_icudt_name"] = function() {
  return (_mono_wasm_get_icudt_name = Module["_mono_wasm_get_icudt_name"] = Module["asm"]["mono_wasm_get_icudt_name"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_wasm_load_icu_data = Module["_mono_wasm_load_icu_data"] = function() {
  return (_mono_wasm_load_icu_data = Module["_mono_wasm_load_icu_data"] = Module["asm"]["mono_wasm_load_icu_data"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_print_method_from_ip = Module["_mono_print_method_from_ip"] = function() {
  return (_mono_print_method_from_ip = Module["_mono_print_method_from_ip"] = Module["asm"]["mono_print_method_from_ip"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _mono_set_timeout_exec = Module["_mono_set_timeout_exec"] = function() {
  return (_mono_set_timeout_exec = Module["_mono_set_timeout_exec"] = Module["asm"]["mono_set_timeout_exec"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _ntohs = Module["_ntohs"] = function() {
  return (_ntohs = Module["_ntohs"] = Module["asm"]["ntohs"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = function() {
  return (_emscripten_main_thread_process_queued_calls = Module["_emscripten_main_thread_process_queued_calls"] = Module["asm"]["emscripten_main_thread_process_queued_calls"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _htonl = Module["_htonl"] = function() {
  return (_htonl = Module["_htonl"] = Module["asm"]["htonl"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var __get_tzname = Module["__get_tzname"] = function() {
  return (__get_tzname = Module["__get_tzname"] = Module["asm"]["_get_tzname"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var __get_daylight = Module["__get_daylight"] = function() {
  return (__get_daylight = Module["__get_daylight"] = Module["asm"]["_get_daylight"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var __get_timezone = Module["__get_timezone"] = function() {
  return (__get_timezone = Module["__get_timezone"] = Module["asm"]["_get_timezone"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackSave = Module["stackSave"] = function() {
  return (stackSave = Module["stackSave"] = Module["asm"]["stackSave"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackRestore = Module["stackRestore"] = function() {
  return (stackRestore = Module["stackRestore"] = Module["asm"]["stackRestore"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var stackAlloc = Module["stackAlloc"] = function() {
  return (stackAlloc = Module["stackAlloc"] = Module["asm"]["stackAlloc"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = function() {
  return (_emscripten_stack_set_limits = Module["_emscripten_stack_set_limits"] = Module["asm"]["emscripten_stack_set_limits"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _setThrew = Module["_setThrew"] = function() {
  return (_setThrew = Module["_setThrew"] = Module["asm"]["setThrew"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
  return (___cxa_can_catch = Module["___cxa_can_catch"] = Module["asm"]["__cxa_can_catch"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
  return (___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = Module["asm"]["__cxa_is_pointer_type"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _memalign = Module["_memalign"] = function() {
  return (_memalign = Module["_memalign"] = Module["asm"]["memalign"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vi = Module["dynCall_vi"] = function() {
  return (dynCall_vi = Module["dynCall_vi"] = Module["asm"]["dynCall_vi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ii = Module["dynCall_ii"] = function() {
  return (dynCall_ii = Module["dynCall_ii"] = Module["asm"]["dynCall_ii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viii = Module["dynCall_viii"] = function() {
  return (dynCall_viii = Module["dynCall_viii"] = Module["asm"]["dynCall_viii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  return (dynCall_viiiiii = Module["dynCall_viiiiii"] = Module["asm"]["dynCall_viiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
  return (dynCall_iiiiii = Module["dynCall_iiiiii"] = Module["asm"]["dynCall_iiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiii = Module["dynCall_viiii"] = function() {
  return (dynCall_viiii = Module["dynCall_viiii"] = Module["asm"]["dynCall_viiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_v = Module["dynCall_v"] = function() {
  return (dynCall_v = Module["dynCall_v"] = Module["asm"]["dynCall_v"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vii = Module["dynCall_vii"] = function() {
  return (dynCall_vii = Module["dynCall_vii"] = Module["asm"]["dynCall_vii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_i = Module["dynCall_i"] = function() {
  return (dynCall_i = Module["dynCall_i"] = Module["asm"]["dynCall_i"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiii = Module["dynCall_iiii"] = function() {
  return (dynCall_iiii = Module["dynCall_iiii"] = Module["asm"]["dynCall_iiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  return (dynCall_viiiii = Module["dynCall_viiiii"] = Module["asm"]["dynCall_viiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  return (dynCall_iiiii = Module["dynCall_iiiii"] = Module["asm"]["dynCall_iiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iii = Module["dynCall_iii"] = function() {
  return (dynCall_iii = Module["dynCall_iii"] = Module["asm"]["dynCall_iii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function() {
  return (dynCall_viiiiiii = Module["dynCall_viiiiiii"] = Module["asm"]["dynCall_viiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = function() {
  return (dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = Module["asm"]["dynCall_viiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function() {
  return (dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = function() {
  return (dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = function() {
  return (dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function() {
  return (dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = Module["asm"]["dynCall_iiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function() {
  return (dynCall_iiiiiii = Module["dynCall_iiiiiii"] = Module["asm"]["dynCall_iiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jiiiiiiiii = Module["dynCall_jiiiiiiiii"] = function() {
  return (dynCall_jiiiiiiiii = Module["dynCall_jiiiiiiiii"] = Module["asm"]["dynCall_jiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vj = Module["dynCall_vj"] = function() {
  return (dynCall_vj = Module["dynCall_vj"] = Module["asm"]["dynCall_vj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iji = Module["dynCall_iji"] = function() {
  return (dynCall_iji = Module["dynCall_iji"] = Module["asm"]["dynCall_iji"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ij = Module["dynCall_ij"] = function() {
  return (dynCall_ij = Module["dynCall_ij"] = Module["asm"]["dynCall_ij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iij = Module["dynCall_iij"] = function() {
  return (dynCall_iij = Module["dynCall_iij"] = Module["asm"]["dynCall_iij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jj = Module["dynCall_jj"] = function() {
  return (dynCall_jj = Module["dynCall_jj"] = Module["asm"]["dynCall_jj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiijiiiii = Module["dynCall_iiijiiiii"] = function() {
  return (dynCall_iiijiiiii = Module["dynCall_iiijiiiii"] = Module["asm"]["dynCall_iiijiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_idi = Module["dynCall_idi"] = function() {
  return (dynCall_idi = Module["dynCall_idi"] = Module["asm"]["dynCall_idi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_idiii = Module["dynCall_idiii"] = function() {
  return (dynCall_idiii = Module["dynCall_idiii"] = Module["asm"]["dynCall_idiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_idddddddddii = Module["dynCall_idddddddddii"] = function() {
  return (dynCall_idddddddddii = Module["dynCall_idddddddddii"] = Module["asm"]["dynCall_idddddddddii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_j = Module["dynCall_j"] = function() {
  return (dynCall_j = Module["dynCall_j"] = Module["asm"]["dynCall_j"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iidiiii = Module["dynCall_iidiiii"] = function() {
  return (dynCall_iidiiii = Module["dynCall_iidiiii"] = Module["asm"]["dynCall_iidiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vidiiii = Module["dynCall_vidiiii"] = function() {
  return (dynCall_vidiiii = Module["dynCall_vidiiii"] = Module["asm"]["dynCall_vidiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiddii = Module["dynCall_iiiddii"] = function() {
  return (dynCall_iiiddii = Module["dynCall_iiiddii"] = Module["asm"]["dynCall_iiiddii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vidiiiii = Module["dynCall_vidiiiii"] = function() {
  return (dynCall_vidiiiii = Module["dynCall_vidiiiii"] = Module["asm"]["dynCall_vidiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iidii = Module["dynCall_iidii"] = function() {
  return (dynCall_iidii = Module["dynCall_iidii"] = Module["asm"]["dynCall_iidii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iidi = Module["dynCall_iidi"] = function() {
  return (dynCall_iidi = Module["dynCall_iidi"] = Module["asm"]["dynCall_iidi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_di = Module["dynCall_di"] = function() {
  return (dynCall_di = Module["dynCall_di"] = Module["asm"]["dynCall_di"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_dii = Module["dynCall_dii"] = function() {
  return (dynCall_dii = Module["dynCall_dii"] = Module["asm"]["dynCall_dii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function() {
  return (dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function() {
  return (dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiiiiii = Module["dynCall_iiiiiiiiiii"] = function() {
  return (dynCall_iiiiiiiiiii = Module["dynCall_iiiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiidi = Module["dynCall_iiidi"] = function() {
  return (dynCall_iiidi = Module["dynCall_iiidi"] = Module["asm"]["dynCall_iiidi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiidi = Module["dynCall_iiiidi"] = function() {
  return (dynCall_iiiidi = Module["dynCall_iiiidi"] = Module["asm"]["dynCall_iiiidi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiidii = Module["dynCall_viiiidii"] = function() {
  return (dynCall_viiiidii = Module["dynCall_viiiidii"] = Module["asm"]["dynCall_viiiidii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ji = Module["dynCall_ji"] = function() {
  return (dynCall_ji = Module["dynCall_ji"] = Module["asm"]["dynCall_ji"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiji = Module["dynCall_iiji"] = function() {
  return (dynCall_iiji = Module["dynCall_iiji"] = Module["asm"]["dynCall_iiji"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijjiii = Module["dynCall_iijjiii"] = function() {
  return (dynCall_iijjiii = Module["dynCall_iijjiii"] = Module["asm"]["dynCall_iijjiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vijjjii = Module["dynCall_vijjjii"] = function() {
  return (dynCall_vijjjii = Module["dynCall_vijjjii"] = Module["asm"]["dynCall_vijjjii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiidii = Module["dynCall_iiiidii"] = function() {
  return (dynCall_iiiidii = Module["dynCall_iiiidii"] = Module["asm"]["dynCall_iiiidii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iidiii = Module["dynCall_iidiii"] = function() {
  return (dynCall_iidiii = Module["dynCall_iidiii"] = Module["asm"]["dynCall_iidiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijii = Module["dynCall_iijii"] = function() {
  return (dynCall_iijii = Module["dynCall_iijii"] = Module["asm"]["dynCall_iijii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijiii = Module["dynCall_iijiii"] = function() {
  return (dynCall_iijiii = Module["dynCall_iijiii"] = Module["asm"]["dynCall_iijiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vid = Module["dynCall_vid"] = function() {
  return (dynCall_vid = Module["dynCall_vid"] = Module["asm"]["dynCall_vid"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vijiiii = Module["dynCall_vijiiii"] = function() {
  return (dynCall_vijiiii = Module["dynCall_vijiiii"] = Module["asm"]["dynCall_vijiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiddiii = Module["dynCall_iiiiddiii"] = function() {
  return (dynCall_iiiiddiii = Module["dynCall_iiiiddiii"] = Module["asm"]["dynCall_iiiiddiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jij = Module["dynCall_jij"] = function() {
  return (dynCall_jij = Module["dynCall_jij"] = Module["asm"]["dynCall_jij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_did = Module["dynCall_did"] = function() {
  return (dynCall_did = Module["dynCall_did"] = Module["asm"]["dynCall_did"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_didd = Module["dynCall_didd"] = function() {
  return (dynCall_didd = Module["dynCall_didd"] = Module["asm"]["dynCall_didd"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiidi = Module["dynCall_viiidi"] = function() {
  return (dynCall_viiidi = Module["dynCall_viiidi"] = Module["asm"]["dynCall_viiidi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vij = Module["dynCall_vij"] = function() {
  return (dynCall_vij = Module["dynCall_vij"] = Module["asm"]["dynCall_vij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jii = Module["dynCall_jii"] = function() {
  return (dynCall_jii = Module["dynCall_jii"] = Module["asm"]["dynCall_jii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijiiii = Module["dynCall_iijiiii"] = function() {
  return (dynCall_iijiiii = Module["dynCall_iijiiii"] = Module["asm"]["dynCall_iijiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_diii = Module["dynCall_diii"] = function() {
  return (dynCall_diii = Module["dynCall_diii"] = Module["asm"]["dynCall_diii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vidi = Module["dynCall_vidi"] = function() {
  return (dynCall_vidi = Module["dynCall_vidi"] = Module["asm"]["dynCall_vidi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jd = Module["dynCall_jd"] = function() {
  return (dynCall_jd = Module["dynCall_jd"] = Module["asm"]["dynCall_jd"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jf = Module["dynCall_jf"] = function() {
  return (dynCall_jf = Module["dynCall_jf"] = Module["asm"]["dynCall_jf"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_id = Module["dynCall_id"] = function() {
  return (dynCall_id = Module["dynCall_id"] = Module["asm"]["dynCall_id"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_if = Module["dynCall_if"] = function() {
  return (dynCall_if = Module["dynCall_if"] = Module["asm"]["dynCall_if"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ddd = Module["dynCall_ddd"] = function() {
  return (dynCall_ddd = Module["dynCall_ddd"] = Module["asm"]["dynCall_ddd"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_fff = Module["dynCall_fff"] = function() {
  return (dynCall_fff = Module["dynCall_fff"] = Module["asm"]["dynCall_fff"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_dd = Module["dynCall_dd"] = function() {
  return (dynCall_dd = Module["dynCall_dd"] = Module["asm"]["dynCall_dd"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jiji = Module["dynCall_jiji"] = function() {
  return (dynCall_jiji = Module["dynCall_jiji"] = Module["asm"]["dynCall_jiji"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viijii = Module["dynCall_viijii"] = function() {
  return (dynCall_viijii = Module["dynCall_viijii"] = Module["asm"]["dynCall_viijii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jiiii = Module["dynCall_jiiii"] = function() {
  return (dynCall_jiiii = Module["dynCall_jiiii"] = Module["asm"]["dynCall_jiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiii"] = function() {
  return (dynCall_iiiiiiiiiiiii = Module["dynCall_iiiiiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_fiii = Module["dynCall_fiii"] = function() {
  return (dynCall_fiii = Module["dynCall_fiii"] = Module["asm"]["dynCall_fiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiiiiiiii = Module["dynCall_iiiiiiiiiiii"] = function() {
  return (dynCall_iiiiiiiiiiii = Module["dynCall_iiiiiiiiiiii"] = Module["asm"]["dynCall_iiiiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viiiiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiiiii"] = function() {
  return (dynCall_viiiiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiiiii"] = Module["asm"]["dynCall_viiiiiiiiiiiiiii"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiij = Module["dynCall_iiiiij"] = function() {
  return (dynCall_iiiiij = Module["dynCall_iiiiij"] = Module["asm"]["dynCall_iiiiij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiid = Module["dynCall_iiiiid"] = function() {
  return (dynCall_iiiiid = Module["dynCall_iiiiid"] = Module["asm"]["dynCall_iiiiid"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = function() {
  return (dynCall_iiiiijj = Module["dynCall_iiiiijj"] = Module["asm"]["dynCall_iiiiijj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = function() {
  return (dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = Module["asm"]["dynCall_iiiiiijj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_viff = Module["dynCall_viff"] = function() {
  return (dynCall_viff = Module["dynCall_viff"] = Module["asm"]["dynCall_viff"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_vif = Module["dynCall_vif"] = function() {
  return (dynCall_vif = Module["dynCall_vif"] = Module["asm"]["dynCall_vif"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijj = Module["dynCall_iijj"] = function() {
  return (dynCall_iijj = Module["dynCall_iijj"] = Module["asm"]["dynCall_iijj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijji = Module["dynCall_iijji"] = function() {
  return (dynCall_iijji = Module["dynCall_iijji"] = Module["asm"]["dynCall_iijji"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iijiiij = Module["dynCall_iijiiij"] = function() {
  return (dynCall_iijiiij = Module["dynCall_iijiiij"] = Module["asm"]["dynCall_iijiiij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_iiiij = Module["dynCall_iiiij"] = function() {
  return (dynCall_iiiij = Module["dynCall_iiiij"] = Module["asm"]["dynCall_iiiij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jiiij = Module["dynCall_jiiij"] = function() {
  return (dynCall_jiiij = Module["dynCall_jiiij"] = Module["asm"]["dynCall_jiiij"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ff = Module["dynCall_ff"] = function() {
  return (dynCall_ff = Module["dynCall_ff"] = Module["asm"]["dynCall_ff"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_dddd = Module["dynCall_dddd"] = function() {
  return (dynCall_dddd = Module["dynCall_dddd"] = Module["asm"]["dynCall_dddd"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ddi = Module["dynCall_ddi"] = function() {
  return (dynCall_ddi = Module["dynCall_ddi"] = Module["asm"]["dynCall_ddi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ffff = Module["dynCall_ffff"] = function() {
  return (dynCall_ffff = Module["dynCall_ffff"] = Module["asm"]["dynCall_ffff"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_ffi = Module["dynCall_ffi"] = function() {
  return (dynCall_ffi = Module["dynCall_ffi"] = Module["asm"]["dynCall_ffi"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_fiff = Module["dynCall_fiff"] = function() {
  return (dynCall_fiff = Module["dynCall_fiff"] = Module["asm"]["dynCall_fiff"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_fif = Module["dynCall_fif"] = function() {
  return (dynCall_fif = Module["dynCall_fif"] = Module["asm"]["dynCall_fif"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var dynCall_jijj = Module["dynCall_jijj"] = function() {
  return (dynCall_jijj = Module["dynCall_jijj"] = Module["asm"]["dynCall_jijj"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _asyncify_start_unwind = Module["_asyncify_start_unwind"] = function() {
  return (_asyncify_start_unwind = Module["_asyncify_start_unwind"] = Module["asm"]["asyncify_start_unwind"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _asyncify_stop_unwind = Module["_asyncify_stop_unwind"] = function() {
  return (_asyncify_stop_unwind = Module["_asyncify_stop_unwind"] = Module["asm"]["asyncify_stop_unwind"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _asyncify_start_rewind = Module["_asyncify_start_rewind"] = function() {
  return (_asyncify_start_rewind = Module["_asyncify_start_rewind"] = Module["asm"]["asyncify_start_rewind"]).apply(null, arguments);
};

/** @type {function(...*):?} */
var _asyncify_stop_rewind = Module["_asyncify_stop_rewind"] = function() {
  return (_asyncify_stop_rewind = Module["_asyncify_stop_rewind"] = Module["asm"]["asyncify_stop_rewind"]).apply(null, arguments);
};


function invoke_vi(index,a1) {
  var sp = stackSave();
  try {
    dynCall_vi(index,a1);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return dynCall_ii(index,a1);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    dynCall_vii(index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  var sp = stackSave();
  try {
    return dynCall_iii(index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return dynCall_iiii(index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    dynCall_v(index);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiii(index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    dynCall_viiii(index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    return dynCall_iiiiii(index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    dynCall_viii(index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return dynCall_iiiii(index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_jiiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    return dynCall_jiiii(index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_fiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return dynCall_fiii(index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_diii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return dynCall_diii(index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_i(index) {
  var sp = stackSave();
  try {
    return dynCall_i(index);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  var sp = stackSave();
  try {
    dynCall_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_iiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11) {
  var sp = stackSave();
  try {
    return dynCall_iiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}

function invoke_viiiiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15) {
  var sp = stackSave();
  try {
    dynCall_viiiiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15);
  } catch(e) {
    stackRestore(sp);
    if (e !== e+0 && e !== 'longjmp') throw e;
    _setThrew(1, 0);
  }
}




// === Auto-generated postamble setup entry stuff ===

Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
Module["setValue"] = setValue;
Module["getValue"] = getValue;
Module["UTF8ArrayToString"] = UTF8ArrayToString;
Module["UTF8ToString"] = UTF8ToString;
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["FS_createPath"] = FS.createPath;
Module["FS_createDataFile"] = FS.createDataFile;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["FS_createLazyFile"] = FS.createLazyFile;
Module["FS_createDevice"] = FS.createDevice;
Module["FS_unlink"] = FS.unlink;
Module["addFunction"] = addFunction;

var calledRun;

/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};

/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  preRun();

  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }

  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
}
Module['run'] = run;

/** @param {boolean|number=} implicit */
function exit(status, implicit) {
  EXITSTATUS = status;

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && keepRuntimeAlive() && status === 0) {
    return;
  }

  if (keepRuntimeAlive()) {
  } else {

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);

    ABORT = true;
  }

  quit_(status, new ExitStatus(status));
}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

run();






/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * A simple class to handle HTTP request in the browser
 *
 * @author Edouard Lafargue <edouard@lafargue.name>
 *
 */

define(function(require) {

    "use strict";


    // Private functions
    function is (type, obj) {
        return Object.prototype.toString.call(obj) === '[object '+type+']';
    }

    function isArray (obj) {
        return is("Array", obj);
    }

    function isObject (obj) {
        return is("Object", obj);
    }

    function isString (obj) {
        return is("String", obj);
    }

    function isNumber (obj) {
        return is("Number", obj);
    }

    function isBoolean (obj) {
        return is("Boolean", obj);
    }

    function isNull (obj) {
        return typeof obj === "object" && !obj;
    }

    function isUndefined (obj) {
    return typeof obj === "undefined";
    }

    var stack = [];

    return {

        /**
         * <p>Converts an arbitrary value to a Query String representation.</p>
         *
         * <p>Objects with cyclical references will trigger an exception.</p>
         *
         * @method stringify
         * @param obj {Variant} any arbitrary value to convert to query string
         * @param sep {String} (optional) Character that should join param k=v pairs together. Default: "&"
         * @param eq  {String} (optional) Character that should join keys to their values. Default: "="
         * @param name {String} (optional) Name of the current key, for handling children recursively.
         * @param escape {Function} (optional) Function for escaping. Default: encodeURIComponent
         */
        // https://github.com/jazzychad/querystring.node.js/blob/master/querystring-stringify.js
        stringify: function(obj, sep, eq, name, escape) {
          sep = sep || "&";
          eq = eq || "=";
          escape = escape || encodeURIComponent;

          if (isNull(obj) || isUndefined(obj) || typeof(obj) === 'function') {
            return name ? escape(name) + eq : '';
          }

          if (isBoolean(obj)) obj = +obj;
          if (isNumber(obj) || isString(obj)) {
            return escape(name) + eq + escape(obj);
          }
          if (isArray(obj)) {
            var s = [];
            name = name+'[]';
            for (var i = 0, l = obj.length; i < l; i ++) {
              s.push( this.stringify(obj[i], sep, eq, name, escape) );
            }
            return s.join(sep);
          }

          // Check for cyclical references in nested objects
          for (var i = stack.length - 1; i >= 0; --i) if (stack[i] === obj) {
            throw new Error("stringify. Cyclical reference");
          }

          stack.push(obj);

          var s = [];
          var begin = name ? name + '[' : '';
          var end = name ? ']' : '';
          for (var i in obj) if (obj.hasOwnProperty(i)) {
            var n = begin + i + end;
            s.push(this.stringify(obj[i], sep, eq, n, escape));
          }

          stack.pop();

          s = s.join(sep);
          if (!s && name) return name + "=";
          return s;
        },

        textify: function(obj) {
            var body = '';
            for (var key in obj) {
                body += key + '=' + obj[key] + '\n';
            }
            return body;
        },

        /**
         * Build a multipart form containing a text file.
         *  obj is all the key/values including the file
         *  filekey is the key name that contains the file
         *  fname is the filename that should be used
         */
        multipart: function(obj, filekey, fname) {
            var fd = new FormData();
            for (var key in obj) {
                if (key == filekey) {
                    var filePart = [ obj[key] ];
                    var myBlob = new Blob( filePart, { type:'text/plain'});
                    fd.append(key, myBlob, fname);
                } else
                    fd.append(key, obj[key]);
            }
            return fd;
        },


        // Returns a function that will do a XMLhttpRequest for us
        request: function(options, callback) {
            var xhr = new XMLHttpRequest();

            // Setup all options, check for errors
            if (options.method != "GET" && options.method != "POST")
                throw "Invalid Method";
            if (options.host == undefined || options.host == "")
                throw "Invalid Host";
            options.path = options.path || "";
            options.proto = (options.proto || "http") + "://"

            xhr.open(options.method, options.proto + options.host + options.path);
            if (options.headers != undefined) {
                for (var i in options.headers) {
                    xhr.setRequestHeader(i, options.headers[i]);
                }
            }
            xhr.onreadystatechange = callback;

            return new function() {
                this.send = function(data) {
                    xhr.send(data);
                }
            }
        }
    }
});
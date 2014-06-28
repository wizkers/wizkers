/**
 * A browser-side implementation of the same type of API as the
 * Node.js Serialport library
 *
 * I only implement what makes sense for my application.
 *
 * Copyright 2014 Edouard Lafargue <edouard@lafargue.name>
 * All rights reserved.
 *
 * based on NodeSerial Parsers, Copyright 2011 Chris Williams <chris@iterativedesigns.com>
 * 
 */

define(function(require) {
    
    "use strict";
    
    // From chrome developer API:
    function ab2str(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
    };

    // Convert string to ArrayBuffer
    var str2ab = function(str) {
        var buf=new ArrayBuffer(str.length);
        var bufView=new Uint8Array(buf);
        for (var i=0; i<str.length; i++) {
            bufView[i]=str.charCodeAt(i);
        }
        return buf;
    };


    // Inportant: buffer is a Javascript ArrayBuffer
    var parsers ={
          raw: function (emitter, buffer) {
            emitter.emit("data", buffer);
          },
          //encoding: ascii utf8 utf16le ucs2 base64 binary hex
          //More: http://nodejs.org/api/buffer.html#buffer_buffer
          readline: function (delimiter, encoding) {
            if (typeof delimiter === "undefined" || delimiter === null) { delimiter = "\r"; }
            if (typeof encoding  === "undefined" || encoding  === null) { encoding  = "utf8"; }
            // Delimiter buffer saved in closure
            var data = "";
            return function (emitter, buffer) {
              // Collect data
              data += ab2str(buffer);
              // Split collected data by delimiter
              var parts = data.split(delimiter);
              data = parts.pop();
              parts.forEach(function (part, i, array) {
                emitter.trigger('data', part);
              });
            };
          }
        };

    return {
        
        parsers: parsers
        
    }
    
});
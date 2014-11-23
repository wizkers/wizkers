/**
 *  IntelHex parser.
 *
 * Algorithm from https://github.com/bminer/intel-hex.js/blob/master/index.js (MIT License)
 *
 * Adapted for proper Javascript ArrayBuffers
 *
 * Original code (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

define(function(require) {
    
    "use strict";
   
     var abu = require('app/lib/abutils');
    
    /* intel_hex.parse(data)
        `data` - Intel Hex file (string in ASCII format or Buffer Object)

        returns an Object with the following properties:
            - data - data as a Buffer Object, padded with 0xFF
                where data is empty.
            - startSegmentAddress - the address provided by the last
                start segment address record; null, if not given
            - startLinearAddress - the address provided by the last
                start linear address record; null, if not given
        Special thanks to: http://en.wikipedia.org/wiki/Intel_HEX
    */
    function parseIntelHex(data) {
        
        var DATA = 0,
	       END_OF_FILE = 1,
	       EXT_SEGMENT_ADDR = 2,
	       START_SEGMENT_ADDR = 3,
	       EXT_LINEAR_ADDR = 4,
	       START_LINEAR_ADDR = 5,
           EMPTY_VALUE = 0xFF;
        
        if (data instanceof ArrayBuffer)
            data = abu.ab2str(data);

        //Initialization
        var buf = new Uint8Array(8192),
            bufLength = 0, //Length of data in the buffer
            highAddress = 0, //upper address
            startSegmentAddress = null,
            startLinearAddress = null,
            lineNum = 0, //Line number in the Intel Hex string
            pos = 0; //Current position in the Intel Hex string
        var SMALLEST_LINE = 11;
        while(pos + SMALLEST_LINE <= data.length)
        {
            //Parse an entire line
            if(data.charAt(pos++) != ":")
                throw new Error("Line " + (lineNum+1) +
                    " does not start with a colon (:).");
            else
                lineNum++;
            //Number of bytes (hex digit pairs) in the data field
            var dataLength = parseInt(data.substr(pos, 2), 16);
            pos += 2;
            //Get 16-bit address (big-endian)
            var lowAddress = parseInt(data.substr(pos, 4), 16);
            pos += 4;
            //Record type
            var recordType = parseInt(data.substr(pos, 2), 16);
            pos += 2;

            //Data field (hex-encoded string)
            var dataField = data.substr(pos, dataLength * 2);
            var dataFieldBuf = abu.hextoab(dataField);
            pos += dataLength * 2;

            //Checksum
            var checksum = parseInt(data.substr(pos, 2), 16);
            pos += 2;

            //Validate checksum
            var calcChecksum = (dataLength + (lowAddress >> 8) +
                lowAddress + recordType) & 0xFF;
            for(var i = 0; i < dataLength; i++)
                calcChecksum = (calcChecksum + dataFieldBuf[i]) & 0xFF;
            calcChecksum = (0x100 - calcChecksum) & 0xFF;

            if(checksum != calcChecksum)
                throw new Error("Invalid checksum on line " + lineNum +
                    ": got " + checksum + ", but expected " + calcChecksum);

            //Parse the record based on its recordType
            switch(recordType)
            {
                case DATA:
                    var absoluteAddress = highAddress + lowAddress;
                    //Expand buf, if necessary
                    if(absoluteAddress + dataLength >= buf.byteLength)
                    {
                        var tmp = new Uint8Array((absoluteAddress + dataLength) * 2);
                        tmp.set(buf);
                        buf = tmp;
                    }
                    //Write over skipped bytes with EMPTY_VALUE
                    if(absoluteAddress > bufLength) {
                        for (var i=bufLength; i < absoluteAddress; i++) {
                            buf[i] = EMPTY_VALUE;
                        }
                    }
                    //Write the dataFieldBuf to buf
                    buf.set(dataFieldBuf, absoluteAddress);
                    // dataFieldBuf.copy(buf, absoluteAddress);
                    bufLength = Math.max(bufLength, absoluteAddress + dataLength);
                    break;
                case END_OF_FILE:
                    if(dataLength != 0)
                        throw new Error("Invalid EOF record on line " +
                            lineNum + ".");
                    return {
                        "data": buf.subarray(0, bufLength),
                        "startSegmentAddress": startSegmentAddress,
                        "startLinearAddress": startLinearAddress
                    };
                    break;
                case EXT_SEGMENT_ADDR:
                    if(dataLength != 2 || lowAddress != 0)
                        throw new Error("Invalid extended segment address record on line " +
                            lineNum + ".");
                    highAddress = parseInt(dataField, 16) << 4;
                    break;
                case START_SEGMENT_ADDR:
                    if(dataLength != 4 || lowAddress != 0)
                        throw new Error("Invalid start segment address record on line " +
                            lineNum + ".");
                    startSegmentAddress = parseInt(dataField, 16);
                    break;
                case EXT_LINEAR_ADDR:
                    if(dataLength != 2 || lowAddress != 0)
                        throw new Error("Invalid extended linear address record on line " +
                            lineNum + ".");
                    highAddress = parseInt(dataField, 16) << 16;
                    break;
                case START_LINEAR_ADDR:
                    if(dataLength != 4 || lowAddress != 0)
                        throw new Error("Invalid start linear address record on line " +
                            lineNum + ".");
                    startLinearAddress = parseInt(dataField, 16);
                    break;
                default:
                    throw new Error("Invalid record type (" + recordType +
                        ") on line " + lineNum);
                    break;
            }
            //Advance to the next line
            if(data.charAt(pos) == "\r")
                pos++;
            if(data.charAt(pos) == "\n")
                pos++;
        }
        throw new Error("Unexpected end of input: missing or invalid EOF record.");

        }
    
    return { parse: parseIntelHex };
    
});
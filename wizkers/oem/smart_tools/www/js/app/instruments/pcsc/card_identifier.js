/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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

/*
 * These utilities do ATR parsing for many types of ATR, including
 * PCSC 2.0 Contactless ATR parsing
 */

if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {

    "use strict";

    var abutils = require('app/lib/abutils');
    var SCList = require('./smartcard_list.js');

    var available_utils = [];
    var byte_index = 0; // Index for parsing multiple TA/TB/TC bytes (TA1, TA2, etc);
    var K = 0; // Number of historical bytes
    var g_Fi = 0;
    var g_F = 0;
    var g_Fmax = 0;

    /**
     * Formatting of a number as a hex byte
     * @param {Number} dec 
     */
    function hexbyte(dec) {
        return '0x' + ('00' + dec.toString(16)).slice(-2).toUpperCase();
    }

    function binnibble(dec) {
        return '0b' + ('0000' + dec.toString(2)).slice(-4);
    }

   /**
    * Lookup card model and possible utilities from the database.
    *  @param {String} atr the ATR as a hex string
    */
    function getCard(atr) {
        var a1 = atr.replace(/(.{2})/g,"$1 ").toUpperCase();
        a1 = a1.slice(0,-1); // Remove last space
        var hits = [];
        for (var card in SCList) {
            for (atr in SCList[card].atrs) {
                if (a1.match(SCList[card].atrs[atr])) {
                    SCList[card].candidates.forEach(function(c) {
                        hits.push(c);
                        lookForUtilities(c);
                    });
                }
            }
        }
        return hits;
    }

    /**
     * Return a utilityu name for the front-end so that we can load a card-specific pane
     * @param {String} desc 
     */
    function lookForUtilities(desc) {
        if (desc.match(/calypso/i)) {
            available_utils.push('calypso');
        }
        if (desc.match(/mobib/i)) {
            available_utils.push('calypso');
        }
        if (desc.match(/ultralight/i)) {
            available_utils.push('mifare_ul');
        } else if (desc.match(/mifare/i)) {
            available_utils.push('mifare');
        } else if (desc.match(/model\s3/i)) {
            available_utils.push('model3nfc');
        } else if (desc.match(/Gallagher Desfire/i)) {
            available_utils.push('desfire');
        }
    }

    /**
    * Parses an ATR
    * @param {String} atr the ATR as a hex string
    */
    function parseATR(atr_str) {
        available_utils = []; // Reset it

        let atr = [].slice.call(abutils.hextoab(atr_str)); // Make it an array of bytes
        let result = ''; // Text description of the parsed ATR

        // Now parse every part of the ATR:
        byte_index = 0;

        // TS: first byte returned by reader (not part of ATR proper)
        let TS = atr.shift(); 
        result += '<b>TS: ' + hexbyte(TS) + '</b> - ';
        switch (TS) {
            case 0x3b:
                result += 'Direct convention';
                break;
            case 0x3f:
                result += 'Inverse convention';
                break;
            default:
                result += 'WARNING: unknown initial ATR byte'
        }
        result += '.<br>';

        // T0
        result += parseTi(atr);

        // Checksum (simple XOR)
        if (atr.length == (K+1)) { // atr is now down to the last remaining bytes
            let tck_val = atr.pop();
            let tck_calc = 0;
            let original_atr = abutils.hextoab(atr_str);
            for (var i = 1; i < original_atr.length; i++) {
                tck_calc ^= original_atr[i];
            }
            var tck_result = '<b>Checksum:</b> ' + tck_val;
            tck_result += (tck_calc == 0) ? '- OK' : '- Wrong, expected ' + hexbyte(tck_val ^ tck_calc);
        }

        // Now analyze the historical bytes
        if (K > 0)
            result += parseHistorical(atr);

        result += '----<br>' + tck_result;

        // Last, identify the card
        var hits = getCard(atr_str);
        var resp = { atr_desc: result, candidates: hits };
        if (available_utils.length > 0)
            resp.utilities = Array.from(new Set(available_utils)); // Deduped array
        
        return resp;
    }

    // Parse TA
    // How we parse depends on the byte_index
    var parseTA = function(atr) {
        const Fi   = [ 372, 372, 558, 744, 1116, 1488, 1860, 'RFU', 'RFU', 512, 768, 1024, 1536, 2048, 'RFU', 'RFU'];
        const Fmax = [   4,   5,   6,   8,   12,   16,   20,   '-',   '-',   5, 7.5,   10,   15,   20,   '-',   '-'];
        const Di   = [ 'RFU', 1, 2, 4, 6, 16, 32, 64, 12, 20, 'RFU','RFU','RFU','RFU','RFU','RFU'];
        const ClockStop = [ "Clock stop not supported", "State L", "State H", "No preference"];

        let T = atr.shift();
        let r = '<b>TA' + byte_index + ': ' + hexbyte(T) + '</b><br>    '; 
        let upper = T >> 4,
            lower = T & 0x0f;

        switch (byte_index) {
            case 1:
                r += 'Fi: ' + Fi[upper] + ', Di: ' + Di[lower] + '<br>    ';
                r += 'Fmax: ' + Fmax[upper] + ' MHz (' + Fmax[upper]*1e6/(Fi[upper]/Di[lower]) + ' bits/s)';
                break;
            case 2:
                r += 'Specific mode byte, T=' + hexbyte(lower) + '<br>    ';
                r += ( upper & 0x08) ? 'unable to change' : 'capable to change';
                r += '<br>    ';
                r += ( upper & 0x01) ? 'implicit F and D shall apply' : 'Fi and Di from TA1 shall apply';
                break;
            default:
                r +=  'Clock stop: ' + ClockStop[upper >>2];
                break;
        }

        return r + '<br>';

    }

    // Parse TB
    var parseTB = function(atr) {
        let T = atr.shift();
        let r = '<b>TB' + byte_index + ': ' + hexbyte(T) + '</b><br>    ';

        switch (byte_index) {
            case 1:
            case 2:
                r += 'TB' + byte_index + ' is deprecated.';
                break;
            default:
                r += 'TB' + byte_index + ' is not supported by this parser';
        }
        
        return r + '<br>';
    }
    
    // Parse TC
    var parseTC = function(atr) {
        let T = atr.shift();
        let r = '<b>TC' + byte_index + ': ' + hexbyte(T) + '</b><br>    ';
        switch (byte_index) {
            case 1:
                r += 'Extra guard time:' + hexbyte(T);
                if (T == 255) {
                    r += ' - special value, character guard time fixed to 11';
                }
                break;
            case 2:
                r += 'Waiting time (WI): ' + hexbyte(T);
                break;
            default:
                r += 'TC' + byte_index + ' is not supported by this parser';
        }

        return r + '<br>';    
    }

    // Parse T0 or TD
    var parseTi = function(atr) {
        let Ti = atr.shift();
        let Y = Ti >> 4;
        let T = Ti & 0x0f;
        let r = '<b>T' + ((byte_index) ? 'D':'' )+ byte_index + ': ' + hexbyte(Ti) + '</b><br>    ';
        r += 'Y' + (byte_index+1) + ': ' + binnibble(Y) + '<br>    ';
        
        if (byte_index == 0) {
            r += 'K: ' + T + '(number of historical bytes)';
            K = T; // Save at global scope;
        } else {
            r += 'Transmission protocol: ' + T;
            if (T == 15) {
                r += '<br>    Interface specs for all protocols are next';
            } else {
                r += '<br>    Interface specs for T=' + T + ' are next';
            }
        }

        r += '<br>';

        byte_index++;
        if (atr.length == 0)
            return r;

        // TAi exists if Yi bit 0 is 1
        if (Y & 0x01) {
            r += parseTA(atr);
        }
        
        // TB
        if (Y & 0x02) {
            r += parseTB(atr);
        }

        // TC
        if (Y & 0x04) {
            r += parseTC(atr);
        }

        // TD
        if (Y & 0x08) {
            r += parseTi(atr);
        }

        return r;
    }

    var parseHistorical = function(atr) {
        let r = '<b>Historical bytes:</b> ' + abutils.ui8tohex(new Uint8Array(atr)).replace(/(.{2})/g,"$1 ").toUpperCase() + '<br>'; 

        // Those are parsed according to ISO7816-4
        let category = atr.shift();
        if (category == null)
            return; // This can happen

        r += '<b>Category indicator: ' + hexbyte(category) + '(';

        switch (category) {
            case 0x00:
                r += 'Compact-TLV data object plus status indicator)</b><br>';
                // Remove the last three bytes:
                let status = [];
                let i = 2;
                while ( i >= 0) {
                    status[i--] = atr.pop();
                }
                while (atr.length)
                    r += parseCompactTLV(atr);
                r += '<b>Status indicator:</b><br>';
                r += '    LCS: ' + hexbyte(status[0]) + '<br>';
                r += '     SW: ' + ("00" + (status[1] << 8 + status[2]).toString(16)).slice(-4) + '<br>';
                break;

            case 0x10:
                r += 'DIR data reference)</b><br>';
                r += '        DIR data reference: ' + hexbyte(atr.shift());
                break;

            case 0x80:
                r += 'Compact-TLV data object)</b><br>';
                while (atr.length)
                    r += parseCompactTLV(atr);
                break;
            case 0x81:
            case 0x82:
            case 0x83:
            case 0x84:
            case 0x85:
            case 0x86:
            case 0x87:
            case 0x88:
            case 0x89:
            case 0x8A:
            case 0x8B:
            case 0x8C:
            case 0x8D:
            case 0x8E:
            case 0x8F:
                r += "reserved for future use)</b><br>";
                break;
            default:
                r += "proprietary format)</b><br>";
                atr.unshift(category);
                r += abutils.hexdump(atr);
                
        }

        return r;
    }
    
    /**
     *  Parse the next TVL tag
     * @param {String} atr 
     */
    var parseCompactTLV = function(atr) {
        let TLV = atr.shift();

        if (TLV == null)
            return 'no TLV present';

        let tag = TLV >> 4;
        let len = TLV & 0x0f;
        let cc = abutils.ui8tohex(new Uint8Array(atr)); // wasteful
        let r = '    Tag: ' + tag + ', length: ' + len + ' (';

        switch (tag) {
            case 0:
                r += 'empty tag)<br>';
                return r;
            case 1:
                r += 'country code)<br>        ';
                
                r += 'ISO 3166-1 code: ' + cc.substr(0,len*2) + '<br>';
                atr.splice(0,len);
                break;
            case 2:
                r += 'issuer identification number)<br>        ';
                // TODO: get a database of issuers
                r += 'ISO 7812-1 code: ' + cc.substr(0, len*2) + '<br>';
                atr.splice(0,len);
                break;
            case 3:
                r += 'card service data byte)<br>';
                if (len != 1) {
                    r += '        Error on tag, expected a length of 1<br>';
                    return r;
                }
                let csdb = atr.shift();
                if (csdb & 0x80) {
                    r += '        - Application selection by full DF name<br>';
                }
                if (csdb & 0x40) {
                    r += '        - Application selection by partial DF name<br>'
                }
                if (csdb & 0x20) {
                    r += '        - BER-TLV data objects available in EF.DIR<br>';
                }
                if (csdb & 0x10) {
                    r += '        - BER-TLV data objects available in EF.ATR<br>';
                }
                switch (csdb & 0x0e) {
                    case 8:
                        r += '        - EF.DIR and ER.ATR access services by the READ BINARY command (transparent structure)<br>';
                        break;
                    case 0:
                        r += '        - EF.DIR and ER.ATR access services by the READ RECORD(s) command (record structure)<br>';
                        break;
                    case 4:
                        r += '        - EF.DIR and ER.ATR access services by the GET DATA command (TLV structure)<br>';
                        break;
                    default:
                        r += '        - unkown bit combination encountered for bits 2 to 4';
                }
                if (csdb & 0x01) {
                    r += '        - Card without MF';
                } else {
                    r += '        - Card with MF';
                }
                
                r += '<br>';
                break;
            case 4:
                r += 'initial access data) - first command  expected after ATR<br>';
                r += '        Value: ' + cc.substr(0,len*2) + '<br>';
                if (len == 0x0f) {
                    // Special case: if len is 0xf, we parse it as an AID
                    r += parseAID(atr);
                } else {
                    atr.splice(0,len);
                }
                break;
            case 5:
                r += 'Card issuer\'s data)<br>';
                r += '        Data:' + cc.substr(0, len*2);
                atr.splice(0,len);
                break;
            case 6:
                r += 'pre-issuing data)<br>';
                r += '        Data:' + cc.substr(0, len*2) + '<br>';
                atr.splice(0,len);
                break;
            case 7:
                r += 'card capabilities)<br>';
                var cardcaps;
                for (var i=0; i < len; i++) {
                    cardcaps = atr.shift(); 
                    r += '        Byte ' + (i+1) + ': ';
                    switch (i) {
                        case 0:
                            r += 'Selection methods:<br>';
                            if (cardcaps & 0x80) {
                                r += '           DF Selection by full DF name<br>';
                            }
                            if (cardcaps & 0x40) {
                                r += '           DF Selection by partial DF name<br>';
                            }
                            if (cardcaps & 0x20) {
                                r += '           DF Selection by path<br>';
                            }
                            if ( cardcaps & 0x10) {
                                r += '           DF Selection by file identifier<br>';
                            }
                            if ( cardcaps & 0x08) {
                                r += '           Implicit DF selection<br>';
                            }
                            if ( cardcaps & 0x04) {
                                r += '           Short EF identifier supported<br>';
                            }
                            if (cardcaps & 0x02) {
                                r += '           Record number supported<br>';
                            }
                            if (cardcaps & 0x01) {
                                r += '           Record identifier supported<br>';
                            }
                            break;
                        case 1:
                            r += 'Data coding byte:<br>';
                            r += '           Value: ' + hexbyte(cardcaps) + '<br>';
                            break;
                        case 2:
                            r += 'command chaining, length fields and logical channels:<br>';
                            r += '           Value: ' + hexbyte(cardcaps)  + '<br>';
                            break;
                    }
                }
                break;
            case 8:
                r += 'status indicator)<br>';
                switch (len) {
                    case 1:
                        r += '        LCS: ' + hexbyte(atr.shift()) + '<br>';
                        break;
                    case 2:
                        r += '         SW: ' + ("00" + (atr.shift() << 8 + atr.shift()).toString(16)).slice(-4) + '<br>';
                        break;
                    case 3:
                        r += '        LCS: ' + hexbyte(atr.shift()) + '<br>';
                        r += '         SW: ' + ("00" + (atr.shift() << 8 + atr.shift()).toString(16)).slice(-4) + '<br>';
                        break;
                }
                break;
            case 0x0f:
                r += 'application identifier)<br>';
                r += '        AID: ' + cc.substr(0, len*2);
                atr.splice(0,len);
                break;
            default:
                r += 'unknown tag)<br>            ';
                r += 'Value: ' + cc.substr(0,len*2) + '<br>';
                atr.splice(0,len);
        }
        return r;
    }

    var parseAID = function(atr) {
        // From PCSC3 v2.01.09
        let len = atr.shift();
        const SS = ["No information given",
                    "ISO 14443 A, part 1",
                    "ISO 14443 A, part 2",
                    "ISO 14443 A, part 3",
                    "RFU",
                    "ISO 14443 B, part 1",
                    "ISO 14443 B, part 2",
                    "ISO 14443 B, part 3",
                    "RFU",
                    "ISO 15693, part 1",
                    "ISO 15693, part 2",
                    "ISO 15693, part 3",
                    "ISO 15693, part 4",
                    "Contact (7816-10) I2C",
                    "Contact (7816-10) Extended I2C",
                    "Contact (7816-10) 2WBP",
                    "Contact (7816-10) 3WBP",
                    "FeliCa",
                    "RFU",
                ];
        const NN = [ "No information given",
                     "Mifare Standard 1K",
                     "Mifare Standard 4K",
                     "Mifare Ultralight",
                     "SLE5RR_XXXX",
                     "undefined",
                     "SR176",
                     "SRI X4K",
                     "AT88RF020",
                     "AT88SC0204CRF",
                     "AT88SC0808CRF",
                     "AT88SC1616CRF",
                     "AT88SC3216CRF",
                     "AT88SC6416CRF",
                     "SRF55V10P",
                     "SRF55V02P",
                     "SRF55V10S",
                     "SRF55V02S",
                     "TAG_IT",
                     "LRI512",
                     "ICODESLI",
                     "TEMPSENS",
                     "I.CODE1",
                     "PicoPass 2K",
                     "PicoPass 2KS",
                     "PicoPass 16K",
                     "PicoPass 16Ks",
                     "PicoPass 16K(8x2)",
                     "PicoPass 16KS(8x2)",
                     "PicoPass 32KS(16+16)",
                     "PicoPass 32KS(16+8x2)",
                     "PicoPass 32KS(8x2+16)",
                     "PicoPass 32KS(8x2+8x2)",
                     "LRI64",
                     "I.CODE UID",
                     "I.CODE EPC",
                     "LRI12",
                     "LRI128",
                     "Mifare Mini",
                    "my-d move (SLE 66R01P)",
                     "my-d NFC (SLE 66RxxP)",
                    "my-d proximity 2 (SLE 66RxxS)",
                    "my-d proximity enhanced (SLE 55RxxE)",
                    "my-d light (SRF 55V01P)",
                    "PJM Stack Tag (SRF 66V10ST)",
                    "PJM Item Tag (SRF 66V10IT)",
                    "PJM Light (SRF 66V01ST)",
                    "Jewel Tag",
                    "Topaz NFC Tag",
                    "AT88SC0104CRF",
                    "AT88SC0404CRF",
                    "AT88RF01C",
                    "AT88RF04C",
                    "i-Code SL2",
                    "MIFARE Plus SL1_2K",
                    "MIFARE Plus SL1_4K",
                    "MIFARE Plus SL2_2K",
                    "MIFARE Plus SL2_4K",
                    "MIFARE Ultralight C",
                    "FeliCa",
                    "Melexis Sensor Tag (MLX90129)",
                    "MiFAFRE Ultralight EV1"
            ];

            let rid = [];
            for (let i = 0; i < 5; i++) {
                rid.push(atr.shift());
            }
            var str_rid = abutils.ui8tohex(new Uint8Array(rid));
            switch (str_rid) {
                case 'a000000306':
                var r = '        RID: A000000306: PC/SC Workgroup<br>';
                let SSidx = atr.shift(); // Card name
                r += '        SS: ' + hexbyte(SSidx) + ' - ' + SS[SSidx] + '<br>';
                var NNidx = (atr.shift()<<8)  + atr.shift();
                r += '        NN: ' + hexbyte(NNidx) + ' - ' + NN[NNidx] + '<br>';
                // For Mifare cards, add a hint on what utilities should be available
                switch (NNidx) {
                    case 1:
                    case 2:
                        available_utils.push("mifare");
                        break;
                    case 3:
                        available_utils.push("mifare_ul");
                        break;
                }
            }
            atr.splice(0, len - 8);
            return r;
        }

    return {
        parseATR: parseATR
    }


});

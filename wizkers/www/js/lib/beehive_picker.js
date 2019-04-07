// beehive_picker.js
//
// Copyright (c) 2015 Yu Iwasaki
// Released under the MIT license
// Permission is hereby granted, free of charge, to any person obtaining a 
// copy of this software and associated documentation files (the 
// "Software"), to deal in the Software without restriction, including 
// without limitation the rights to use, copy, modify, merge, publish, 
// distribute, sublicense, and/or sell copies of the Software, and to 
// permit persons to whom the Software is furnished to do so, subject to 
// the following conditions:
// 
// The above copyright notice and this permission notice shall be 
// included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE 
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION 
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//


if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {

    // var chroma = require('chroma');

    "use strict";

    return (function() {

    this.pickerClick = function(element, e){
        var beehiveID = null;
        var parentElement = element.parentElement;
        var beehiveID = parentElement.getAttribute('beehive-id');
        while (beehiveID == null) {
            parentElement = parentElement.parentElement;
            beehiveID = parentElement.getAttribute('beehive-id');
        }
        var style = window.getComputedStyle(e.target, null);
        if(!e.target.className.match(/(?:^|\s)beehive-picker-hex(?:\s|$)/)){ return; }
        var rgb = style.backgroundColor.match(/[0-9]+/g).map(function(n){ return Number(n); });
        var centerColor = style.backgroundColor;
        if((rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255) || (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0)){ 
        rgb[0] = rgb[1] = rgb[2] = 127;
        centerColor = 'rgb(127,127,127)';
        }
        var r = 255 - rgb[0] === 0 ? 0 : (255 - rgb[0]) / 6;
        var g = 255 - rgb[1] === 0 ? 0 : (255 - rgb[1]) / 6;
        var b = 255 - rgb[2] === 0 ? 0 : (255 - rgb[2]) / 6;
        var left_rgbs =[1,2,3,4,5].map(function(n){ 
        return [Math.round(255 - (r * n)),
                Math.round(255 - (g * n)),
                Math.round(255 - (b * n))]; });
        r = 0 + rgb[0] === 0 ? 0 : (0 + rgb[0]) / 6;
        g = 0 + rgb[1] === 0 ? 0 : (0 + rgb[1]) / 6;
        b = 0 + rgb[2] === 0 ? 0 : (0 + rgb[2]) / 6;
        var right_rgbs =[5,4,3,2,1].map(function(n){ 
        return [Math.round(0 + (r * n)),
                Math.round(0 + (g * n)),
                Math.round(0 + (b * n))]; });
        var colors = '';
        var i = 0;
        var colors = [];
        left_rgbs.forEach(function(val){
            colors.push('rgb(' + val[0] + ',' + val[1] + ',' + val[2] + ')');
        });
        colors.push(centerColor);
        right_rgbs.forEach(function(val){
            colors.push('rgb(' + val[0] + ',' + val[1] + ',' + val[2] + ')');
        });
        var divs = '', styles = '';
        for(var i = 0; i < colors.length; i++){
        divs += '<div class="beehive-picker beehive-picker6"><div class="beehive-picker-hex beehive-picker-2-' + beehiveID + '-' + i + '"></div></div>';
        styles += '.beehive-picker-hex.beehive-picker-2-' + beehiveID + '-' + i + ' { background-color: ' + colors[i] +'; } ';
        }
        var style = document.getElementById('beehive-picker-style-' + beehiveID);
        style.innerHTML = styles;
        var detail = parentElement.getElementsByClassName('beehive-picker-detail')[0];
        detail.innerHTML = divs;
    };

    /*
    * Beehive.Picker
    */
    this.Picker = function(dom, id){
        if(!id){ id = 1; }
        var picker = '<div class="beehive-picker-main" beehive-id="' + id + '"><div class="beehive-pickers"><div class="beehive-pickers-inside">';
        var colorCount = 0;
        [7,8,9,10,11,12,13,12,11,10,9,8,7].forEach(function(n){
        var cl = n === 7 ? 'beehive-picker1' :
                n === 8 ? 'beehive-picker2' :
                n === 9 ? 'beehive-picker3' :
                n === 10 ? 'beehive-picker4' :
                n === 11 ? 'beehive-picker5' :
                n === 12 ? 'beehive-picker6' : 'beehive-picker7';
        for(var i = 0; i < n; i++){
            var next = i === 0 ? 'beehive-picker-next' : '';
            var div = '<div class="beehive-picker ' + next + ' ' + cl + '"><div class="beehive-picker-hex beehive-picker-color' + colorCount + '"></div></div>';
            colorCount++;
            picker += div;
        }
        });
        picker += '</div></div><div class="beehive-picker-detail"></div>'
        picker += '</div>';
        dom.innerHTML = picker;
        if(document.getElementById('beehive-picker-style-' + id)){ return; }
        var st2 = document.createElement('style');
        st2.setAttribute('id', 'beehive-picker-style-' + id);
        document.head.insertBefore(st2, null);
    };

    /*
    * getColorCode
    */
    this.getColorCode = function(element){
        var style = window.getComputedStyle(element, null);
        var rgb = style.backgroundColor
        if(!element.className.match(/(?:^|\s)beehive-picker-hex(?:\s|$)/)){ return null; }
        var ret = eval(rgb.replace(/rgb/,"((").replace(/,/ig,")*256+")).toString(16);
        return "#" + (("000000" + ret).substring( 6 + ret.length - 6));
    };

    /*
    * Create beehive-picker style
    */

    var style = '';
    style += '.beehive-picker-main{ height: 400px; } ';
    style += '.beehive-pickers{ width: 90%; position: relative;} ';
    style += '.beehive-pickers:after {content: ""; display: block; padding-bottom: 100%; }';
    style += '.beehive-pickers-inside{ position: absolute; width: 100%; height: 100%; }';
    // Hexagon width/height ratio of sqr(3)/2
    style += '.beehive-picker { position: relative; float: left; width: 7.69230769231%; padding: 0 0 8.88231183368% 0; -o-transform: rotate(-60deg) skewY(30deg); -moz-transform: rotate(-60deg) skewY(30deg); -webkit-transform: rotate(-60deg) skewY(30deg); -ms-transform: rotate(-60deg) skewY(30deg);transform: rotate(-60deg) skewY(30deg); overflow: hidden;visibility: visible;}';
    style += '.beehive-picker-hex { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -o-transform: skewY(-30deg) rotate(60deg); -moz-transform: skewY(-30deg) rotate(60deg);  -webkit-transform: skewY(-30deg) rotate(60deg); -ms-transform: skewY(-30deg) rotate(60deg); transform: skewY(-30deg) rotate(60deg); overflow: hidden; } ';
    style += '.beehive-picker.beehive-picker-next { clear: both; } ';
    var spacing = 100/13;
    style += '.beehive-picker.beehive-picker1 { left: ' + spacing*3 + '%; margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker2 { left: ' + spacing*5/2 + '%; margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker3 { left: ' + spacing*2 + '%; margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker4 { left: ' + spacing*3/2 + '%; margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker5 { left: ' + spacing + '%;  margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker6 { left: ' + spacing/2 + '%;  margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    style += '.beehive-picker.beehive-picker7 { left: 0px; margin-top: -1.19001064449%; margin-bottom: -1.19001064449%; } ';
    var colors = ["#003366","#336699","#3366CC","#003399","#000099","#0000CC","#000066",
                  "#006666","#006699","#0099CC","#0066CC","#0033CC","#0000FF","#3333FF",
                  "#333399","#669999","#009999","#33CCCC","#00CCFF","#0099FF","#0066FF",
                  "#3366FF","#3333CC","#666699","#339966","#00CC99","#00FFCC","#00FFFF",
                  "#33CCFF","#3399FF","#6699FF","#6666FF","#6600FF","#6600CC","#339933",
                  "#00CC66","#00FF99","#66FFCC","#66FFFF","#66CCFF","#99CCFF","#9999FF",
                  "#9966FF","#9933FF","#9900FF","#006600","#00CC00","#00FF00","#66FF99",
                  "#99FFCC","#CCFFFF","#CCCCFF","#CC99FF","#CC66FF","#CC33FF","#CC00FF",
                  "#9900CC","#003300","#009933","#33CC33","#66FF66","#99FF99","#CCFFCC",
                  "#FFFFFF","#FFCCFF","#FF99FF","#FF66FF","#FF00FF","#CC00CC","#660066",
                  "#336600","#009900","#66FF33","#99FF66","#CCFF99","#FFFFCC","#FFCCCC",
                  "#FF99CC","#FF66CC","#FF33CC","#CC0099","#993399","#333300","#669900",
                  "#99FF33","#CCFF66","#FFFF99","#FFCC99","#FF9999","#FF6699","#FF3399",
                  "#CC3399","#990099","#666633","#99CC00","#CCFF33","#FFFF66","#FFCC66",
                  "#FF9966","#FF6666","#FF0066","#CC6699","#993366","#999966","#CCCC00",
                  "#FFFF00","#FFCC00","#FF9933","#FF6600","#FF5050","#CC0066","#660033",
                  "#996633","#CC9900","#FF9900","#CC6600","#FF3300","#FF0000","#CC0000",
                  "#990033","#663300","#996600","#CC3300","#993300","#990000","#800000","#993333"];
    for(var i = 0; i< colors.length; i++){
        style += '.beehive-picker-hex.beehive-picker-color' + i + ' { background-color: ' + colors[i] +'; } ';
    }
    var st  = document.createElement('style');
    st.setAttribute('id', 'beehive-picker-style');
    st.innerHTML = style;
    document.head.insertBefore(st,null);

    });
});


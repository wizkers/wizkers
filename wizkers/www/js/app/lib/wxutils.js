/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2020 Edouard Lafargue, ed@wizkers.io
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
 *  Various useful utility functions for weather calculations.
 *
 */

if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {

    "use strict";

    return {

        // t in degrees Celcius
        // rh in percent (0-100)
        dew_point: function (t, rh) {
            var v1 = Math.log(rh/100) + 17.625*t/(234.04+t);
            return 243.04 * v1/(17.625-v1);
        },

        // Source: https://www.weather.gov/media/epz/wxcalc/heatIndex.pdf
        heat_index: function(t, rh) {
            return  -8.78469475556 + 1.61139411*t + 2.33854883889*rh
                    - -0.14611605*t*rh - 0.012308094*t*t
                    - -0.0164248277778*rh*rh + 0.002211732*t*t*rh
                    + 0.00072546*t*rh*rh -  0.000003582*t*t*rh*rh;
        }
    }

});
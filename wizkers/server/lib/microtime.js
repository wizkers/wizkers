/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * We use the timestamp as the uniqueID for recordings, so we need a microtime
 * precision.
 * 
 * This native JS implementation comes from https://github.com/yuri0/microtime-nodejs/
 * with MIT License, adatped for Wizkers.
 *
 *  One important change: nowDouble returns time in milliseconds + floating point, not seconds + floating point
 */


var hrtime, milliseconds, delta;
  hrtime = process.hrtime();
  milliseconds = +new Date;
  delta = milliseconds * Math.pow(10, 3) - toMicroseconds(hrtime);



/* module exports */
  module.exports = {
    now: function(){
      return delta + toMicroseconds(process.hrtime());
    },
    nowDouble: function(){
      var nowStr;
      nowStr = this.now().toString();
      return parseFloat(stringInsert(nowStr, nowStr.length - 3, '.'));
    },
    nowStruct: function(){
      var $_;
      $_ = this.now().toString().match(/^(.+)(.{6})$/);
      return [parseInt($_[1]), parseInt($_[2])];
    }
  };


  /* helper functions */
  function toMicroseconds(arg$){
    var seconds, nanoseconds;
    seconds = arg$[0], nanoseconds = arg$[1];
    return parseInt((seconds.toString() + zeroPad(9, nanoseconds.toString())).slice(0, -3));
  }
  function zeroPad(n, str){
    while (str.length < n) {
      str = '0' + str;
    }
    return str;
  }
  function stringInsert(str, index, insertStr){
    return str.slice(0, index) + insertStr + str.slice(index);
  }
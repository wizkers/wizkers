/**
 * We use the timestamp as the uniqueID for recordings, so we need a microtime
 * precision.
 * 
 * This native JS implementation comes from https://github.com/yuri0/microtime-nodejs/
 * with MIT License
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
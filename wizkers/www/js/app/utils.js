/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 *  Various useful utility functions.
 *
 * @author 2014 Edouard Lafargue, ed@lafargue.name
 *
 * Some parts of this code come from Christophe Coenraets.
 */

define(function (require) {

    "use strict";

    return {

        // Returns an array with unique elements from an array
        // that can contain multiple elements, see
        // http://www.shamasis.net/2009/09/fast-algorithm-to-find-unique-items-in-javascript-array/
        // and multiple stackoverflow references:
        unique: function (arr) {
            if (arr == null)
                return [];
            var o = {},
                i, l = arr.length,
                r = [];
            for (i = 0; i < l; i += 1) o[arr[i]] = arr[i];
            for (i in o) r.push(o[i]);
            return r;
        },

        displayValidationErrors: function (messages) {
            for (var key in messages) {
                if (messages.hasOwnProperty(key)) {
                    this.addValidationError(key, messages[key]);
                }
            }
            this.showAlert('Warning!', 'Fix validation errors and try again', 'alert-warning');
        },

        addValidationError: function (field, message) {
            var controlGroup = $('#' + field).parent().parent();
            controlGroup.addClass('error');
            $('.help-inline', controlGroup).html(message);
        },

        removeValidationError: function (field) {
            var controlGroup = $('#' + field).parent().parent();
            controlGroup.removeClass('error');
            $('.help-inline', controlGroup).html('');
        },

        showAlert: function (title, text, klass) {
            $('.alert').removeClass("alert-error alert-warning alert-success alert-info bg-error bg-warning bg-success bg-info bg-danger alert-danger");
            $('.alert').addClass(klass);
            $('.alert').html('<strong>' + title + '</strong> ' + text);
            $('.alert').show();
        },

        hideAlert: function () {
            $('.alert').hide();
        },

        uploadFile: function (path, file, callbackSuccess) {
            var self = this;
            var data = new FormData();
            data.append('file', file);
            $.ajax({
                    url: path,
                    type: 'POST',
                    data: data,
                    processData: false,
                    cache: false,
                    contentType: false
                })
                .done(function (val) {
                    console.log(file.name + " uploaded successfully");
                    callbackSuccess(val);
                })
                .fail(function () {
                    self.showAlert('Error!', 'An error occurred while uploading ' + file.name, 'alert-error');
                });
        },

        hms: function (seconds) {
            var h = parseInt(seconds / 3600, 10),
                m = parseInt(seconds / 60, 10) - h * 60,
                s = Math.floor(seconds % 60);
            return [h, m, s]
                .join(':')
                .replace(/\b\d\b/g,
                    function (a) {
                        return Number(a) === 0 ? '00' : a < 10 ? '0' + a : a;
                    }
                );
        },

        /**
         * Distance between two points. Returns the difference in km
         * @param {Object} loc1 Location 1 {lat: XXX, lon:YYY}
         * @param {Object} loc2 Location 2 {lat: XXX, lon:YYY}
         */
        CoordDistance: function (loc1, loc2) {
            var rad = function (x) {
                return x * Math.PI / 180;
            }

            var R = 6371; //Earth Radius in km
            var dLat = rad(loc2.lat - loc1.lat);
            var dLong = rad(loc2.lng - loc1.lng);

            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(loc1.lat)) * Math.cos(rad(loc2.lat)) * Math.sin(dLong / 2) * Math.sin(dLong / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        },

        /**
         * Formats a decimal coordinate to a text string
         * @param {Number} coord the {lat:XXX, lng: YYY}
         */
        coordToString: function (coord) {
            var ret = {
                lat: '',
                lng: ''
            };

            var deg = Math.floor(coord.lat);
            var min = (Math.abs(coord.lat - deg) * 60);
            var sec = (min - Math.floor(min));
            ret.lat = ((deg < 100) ? '&nbsp;' : '') + ((deg < 10) ? '&nbsp;' : '') +
                deg + '&deg;&nbsp;' + Math.floor(min) + '\'&nbsp;' + (sec * 60).toFixed(3) + '"&nbsp;' + ((deg >= 0) ? 'N' : 'S');

            deg = Math.floor(coord.lng);
            min = (Math.abs(coord.lng - deg) * 60);
            sec = (min - Math.floor(min));
            ret.lng = ((deg < 100) ? '&nbsp;' : '') + ((deg < 100) ? '&nbsp;' : '') +
                deg + '&deg;&nbsp;' + Math.floor(min) + '\'&nbsp;' + (sec * 60).toFixed(3) + '"&nbsp;' + ((deg >= 0) ? 'E' : 'W');

            return ret;
        },

        /**
         * Checks what's visible and what's not on a Bootstrap layout.
         * relies on a couple of (empty) divs on the page
         * @param   {String}  bp Breakpoint we're looking for (xs, md, sm etc)
         * @returns {Boolean} Is it visible?
         */
        checkBreakpoint: function (bp) {
            return $('.screen-' + bp).is(':visible');
        },

        // Thanks to https://andrew.stwrt.ca/posts/js-xml-parsing/
        // No license in the page, but thanks for this nice recursive code:
        xml2json:  function(xml) {
            var data = {};
            var self = this;

            var isText = xml.nodeType === 3,
                isElement = xml.nodeType === 1,
                body = xml.textContent && xml.textContent.trim(),
                hasChildren = xml.children && xml.children.length,
                hasAttributes = xml.attributes && xml.attributes.length;

            // if it's text just return it
            if (isText) { return xml.nodeValue.trim(); }

            // if it doesn't have any children or attributes, just return the contents
            if (!hasChildren && !hasAttributes) { return body; }

            // if it doesn't have children but _does_ have body content, we'll use that
            if (!hasChildren && body.length) { data.text = body; }

            // if it's an element with attributes, add them to data.attributes
            if (isElement && hasAttributes) {
                data.attributes = _.reduce(xml.attributes, function(obj, name, id) {
                var attr = xml.attributes.item(id);
                obj[attr.name] = attr.value;
                return obj;
                }, {});
            }

            // recursively call #parse over children, adding results to data
            _.each(xml.children, function(child) {
                var name = child.nodeName;

                // if we've not come across a child with this nodeType, add it as an object
                // and return here
                if (!_.has(data, name)) {
                data[name] = self.xml2json(child);
                return;
                }

            // if we've encountered a second instance of the same nodeType, make our
            // representation of it an array
            if (!_.isArray(data[name])) { data[name] = [data[name]]; }

            // and finally, append the new child
            data[name].push(parse(child));
          });

        // if we can, let's fold some attributes into the body
        _.each(data.attributes, function(value, key) {
            if (data[key] != null) { return; }
            data[key] = value;
            delete data.attributes[key];
        });

        // if data.attributes is now empty, get rid of it
        if (_.isEmpty(data.attributes)) { delete data.attributes; }

        // simplify to reduce number of final leaf nodes and return
        return data;
    },

        // See http://stackoverflow.com/questions/19098797/fastest-way-to-flatten-un-flatten-nested-json-objects
        JSONflatten: function (data) {
            var result = {};

            function recurse(cur, prop) {
                if (Object(cur) !== cur) {
                    result[prop] = cur;
                } else if (Array.isArray(cur)) {
                    for (var i = 0, l = cur.length; i < l; i++)
                        recurse(cur[i], prop + "[" + i + "]");
                    if (l == 0)
                        result[prop] = [];
                } else {
                    var isEmpty = true;
                    for (var p in cur) {
                        isEmpty = false;
                        recurse(cur[p], prop ? prop + "." + p : p);
                    }
                    if (isEmpty && prop)
                        result[prop] = {};
                }
            }
            recurse(data, "");
            return result;
        },

        JSONunflatten: function (data) {
            "use strict";
            if (Object(data) !== data || Array.isArray(data))
                return data;
            var regex = /\.?([^.\[\]]+)|\[(\d+)\]/g,
                resultholder = {};
            for (var p in data) {
                var cur = resultholder,
                    prop = "",
                    m;
                while (m = regex.exec(p)) {
                    cur = cur[prop] || (cur[prop] = (m[2] ? [] : {}));
                    prop = m[2] || m[1];
                }
                cur[prop] = data[p];
            }
            return resultholder[""] || resultholder;
        },

        // Concatenate two objects
        collate: function (ob1, ob2) {
            var ret = {},
                len = arguments.length,
                arg, i = 0,
                p;

            for (i = 0; i < len; i++) {
                arg = arguments[i];
                if (typeof arg !== "object") {
                    continue;
                }
                for (p in arg) {
                    if (arg.hasOwnProperty(p)) {
                        ret[p] = arg[p];
                    }
                }
            }
            return ret;

        }


    };
});
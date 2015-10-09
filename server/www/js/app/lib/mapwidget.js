/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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

/*
 * A generic Map widget, listening to location events, do be used by any instrument that requires it
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        utils = require('app/utils'),
        Backbone = require('backbone');

    return Backbone.View.extend({

        tagName: "div",
        className: "map",


        initialize: function (options) {

            // Beware: we define "this.rsc" here because if we define it as a "var" on top, the requireJS caching
            // mechanism will turn it into one single reference for every flotplot instance, which is now what we want!
            // Make sure the chart takes all the window height:
            this.rsc = null;
            
            this.markers = [];

        },

        // We have to call onClose when removing this view, because otherwise
        // the window resize callback lives on as a zombie and tries to resize
        // any chart anywhere...
        onClose: function () {
            if (this.rsc)
                $(window).off('resize', this.rsc);
        },

        render: function () {
            console.log("Rendering a simple map widget");
            this.addMap();
            return this;
        },

        addMap: function () {
            var self = this;
            if (typeof (google) == 'undefined') {
                console.log('Error: Google maps API did not load');
                $(this.el).html('<h4>Maps are not available yet</h4>');
                // TODO: this breaks on Chrome apps due to their inflexible content security
                // policy (we can't inject Javascript in the DOM).
                // We want to dynamically load the Google Maps API at this point:

                window.GMAPLoaded = function () {
                    self.render();
                };

                $.getScript('https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=true&callback=GMAPLoaded');

            } else {
                var mapOptions = {
                    zoom: 11,
                    center: new google.maps.LatLng(0, 0),
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                };
                this.map = new google.maps.Map(this.el, mapOptions);
            }

        },

        setCenter: function (lat, lng) {
            this.map.setCenter(new google.maps.LatLng(lat, lng));
        },

        addMarker: function (marker) {
            this.markers.push(new google.maps.Marker({
                position: marker,
                map: this.map,
            }));
        },

        /**
         * Needs to be called in case the enclosing div was resized
         */
        resize: function () {
            if (typeof (google) != 'undefined')
                google.maps.event.trigger(this.map, 'resize');
        }

    });

});
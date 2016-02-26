/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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
    
    
    // There is a known issue on the Google Maps javascript framework which makes it impossible
    // to really delete a map. For this reason, the right thing to do is to have a singleton instance
    // of "map" and reuse it every time, otherwise we get a bad memory leak
    // see https://code.google.com/p/gmaps-api-issues/issues/detail?id=3803
    var globalMap = null;
    var globalMarkers = [];

    return Backbone.View.extend({

        tagName: "div",
        className: "mapwidget",


        initialize: function (options) {
            this.rsc = null;
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
                this.$el.html('<h4>Maps loading...</h4>');
                // TODO: this breaks on Chrome apps due to their inflexible content security
                // policy (we can't inject Javascript in the DOM).
                // We want to dynamically load the Google Maps API at this point:

                window.GMAPLoaded = function () {
                    self.render();
                };

                $.getScript('https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=true&callback=GMAPLoaded');

            } else {
                if (globalMap == null) {
                    var mapOptions = {
                        zoom: 11,
                        center: new google.maps.LatLng(0, 0),
                        mapTypeId: google.maps.MapTypeId.ROADMAP
                    };
                    globalMap = new google.maps.Map(this.el, mapOptions);
                } else {
                    // Reuse the map's div and reinject it into our DOM.
                    this.$el.replaceWith(globalMap.getDiv())
                    this.setElement(globalMap.getDiv());
                }
            }

        },

        setCenter: function (lat, lng) {
            if (vizapp.state == 'paused')
                return;
            globalMap.setCenter(new google.maps.LatLng(lat, lng));
        },

        addMarker: function (marker) {
            var mk = {
                position: {
                    lat: marker.lat,
                    lng: marker.lng
                },
                map: globalMap,
            };
            if (marker.icon)
                mk['icon'] = marker.icon;

            globalMarkers.push(new google.maps.Marker(mk));
        },

        /**
         * Needs to be called in case the enclosing div was resized
         */
        resize: function (mapheight) {
            if (typeof (google) != 'undefined')
                google.maps.event.trigger(globalMap, 'resize');            
        }

    });

});
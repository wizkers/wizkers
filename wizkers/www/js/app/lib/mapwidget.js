/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
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
    var gmapJSRequested = false;
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
                if (gmapJSRequested) {
                    console.log('Waiting for Google Maps JS already, bailing...');
                    return;
                }
                gmapJSRequested = true;
                $.getScript('https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=true&key=AIzaSyDFxVE9J3JhpF93yH46GF3BE6fYBDOXK7s&callback=GMAPLoaded');

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
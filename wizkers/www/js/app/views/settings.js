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

/**
 * The global settings for the applications.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {

    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/SettingsView.js');

    require('bootstrap');

    function deleteDB(dbObj) {
        try {

            var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;

            var dbreq = indexedDB.deleteDatabase(dbObj.id);
            dbreq.onsuccess = function (event) {
                var db = event.result;
                console.log("indexedDB: " + dbObj.id + " deleted");
            }
            dbreq.onerror = function (event) {
                console.error("indexedDB.delete Error: " + event.message);
            }
        } catch (e) {
            console.error("Error: " + e.message);
            //prefer change id of database to start ont new instance
            dbObj.id = dbObj.id + "." + guid();
            console.log("fallback to new database name :" + dbObj.id)
        }
    }


    return Backbone.View.extend({

        initialize: function () {},

        render: function () {
            var self = this;

            this.$el.html(template(this.model.toJSON()));

            // Depending on the runmode, we can display additional info
            if (vizapp.type == 'chrome') {
                $("#chromesettings", this.el).append("<br><h4>Storage</h4>");
                chrome.storage.local.getBytesInUse(function (used) {
                    $("#chromesettings", this.el).append("<p>" + used + " bytes used out of a " +
                        chrome.storage.local.QUOTA_BYTES + " bytes quota.</p>");
                });

                $('#statistics_enable', this.el).show();

            }

            // Disable instrument upgrades on Cordova for now. They work, but they're bound to lead to
            // just too many issues support-wise.
            // NOTE: re-enabled on 2016.06.09 for OTA BLE Updates testing
            if (instrumentManager.getCaps().indexOf("Upgrader") > -1 ) {
                $('#device_upgrade', this.el).show();
            }

            if (instrumentManager.getCaps().indexOf('WizkersSettings') > -1) {
                $('#no-settings', this.el).hide();

                // OK, we have additional settings for this instrument, add them here
                instrumentManager.getWizkersSettings({
                    model: instrumentManager.getInstrument()
                }, function (view) {
                    self.instrumentSettingsView = view;
                    if (view != null) {
                        $('#instrument-settings').html(view.el);
                        view.render();
                    }
                });
            }


            return this;
        },

        onClose: function () {
            if (this.instrumentSettingsView && this.instrumentSettingsView.onClose)
                this.instrumentSettingsView.onClose();
        },

        events: {
            "change": "change",
            "click #reset": "reset_settings",
            "click #reset_storage": "reset_storage_ask",
            "click #do-delete": "do_reset_storage",
            "click .cpmcolor": "selectColor",
            "click #device_upgrade": "device_upgrade"
        },

        change: function (event) {
            console.log("Settings changed");
            // Apply the change to the model
            var target = event.target;
            var change = {};
            change[target.name] = (target.type == "checkbox") ? target.checked : target.value;
            this.model.set(change);
            this.model.save();
            this.render();

            if (target.name == 'enablestats')
                stats.setTrackingEnabled(target.checked);

        },

        device_upgrade: function () {
            var caps = instrumentManager.getCaps();
            if (caps.indexOf("Upgrader") > -1) {
                router.navigate('upgrader/' + instrumentManager.getInstrument().id, true);
            }
        },

        selectColor: function (event) {
            var self = this;
            console.log("Selected color: " + event.target.title);
            this.model.set('default_graph_color', event.target.title);
            this.model.save({
                success: function () {
                    self.render;
                }
            });
        },

        reset_settings: function () {
            var self = this;
            // Clear our global settings/state:
            this.model.clear().set(this.model.defaults);
            this.model.save(null, {
                success: function (model) {
                    utils.showAlert('Success', 'Settings cleared', 'alert-success');
                    self.render();
                    return true;
                },
                error: function () {
                    utils.showAlert('Error', 'An error occurred while trying to clear the settings', 'alert-error');
                }
            });
            return false;
        },

        reset_storage_ask: function () {
            $('#deleteConfirm', this.el).modal('show');
        },

        do_reset_storage: function () {

            var dbreq = indexedDB.open("wizkers-logs", 1);
            dbreq.onsuccess = function (event) {
                var db = event.result;
                console.log(event);
                console.log(dbreq);
            };
            dbreq.onerror = function (event) {
                console.error("indexedDB.delete Error: " + event.message);
            };




            var ins = instrumentManager.getInstrument();
            if (ins != null) {
                linkManager.closeInstrument(ins.id);
            }
            chrome.storage.local.clear();
            instrumentManager.clear();
            $('#deleteConfirm', self.el).modal('hide');
            router.navigate('home', {
                trigger: true
            });
        },



    });
});
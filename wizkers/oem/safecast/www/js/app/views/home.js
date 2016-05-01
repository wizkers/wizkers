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
 * The main screen of our app. Customized for Safecast
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {

    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        httprequest = require('app/lib/httprequest'),
        Devicelog = require('app/models/devicelog'),
        template = require('js/tpl/HomeView.js');

    // We have to require bootstrap whenever we use the Bootstrap javascript
    // library. In this file, we use it for 'modal' calls.
    require('bootstrap');

    var ticks = ['.', 'o', 'O'];

    return Backbone.View.extend({

        initialize: function (options) {

            this.listenTo(outputManager, 'outputTriggered', this.updateOutputStatus);
            this.listenTo(instrumentManager, 'instrumentChanged', this.updateInstrument);

            // Keep a reference to our instrument views to close
            // them properly when we close
            this.instrumentLiveView = null;
            this.instrumentNumericView = null;

            // Avoid changing the button states all the time at each status update.
            // Especially important on mobile devices to save a bit of battery.
            this.currentState = 'undef';
            this.recordingState = 'undef';

            // We manage the instrument UniqueID and storage of its
            // properties in the home view (this is common across all
            // instrument types in the application)
            this.instrumentUniqueID = null;

            this.instrument = instrumentManager.getInstrument();

            // Performance improvement: we keep a cache of the jQuery queries
            // we do most often:
            this.ctrlconnect = null;
            this.ctrlrecord = null;

            this.tick = 0;

        },

        events: {
            "click .ctrl-connect": "ctrlConnect",
            "click .ctrl-diag": "ctrlDiag",
            "click .ctrl-record": "ctrlRecord",
            "click .start-record": "startRecord",
            "click a": "handleaclicks",
            "click #login": "createInstrument"
        },

        /* Nice way to disable an anchor button when it is disabled */
        handleaclicks: function (event) {
            if ($(event.currentTarget).attr('disabled'))
                event.preventDefault();
        },
        
        createInstrument: function() {
            var self = this;

            $("#login").attr('disabled', true);
            $("#login").html("Connecting...");
            
            var post_options = {
                host: 'api.safecast.org',
                port: 443,
                method: 'POST',
                path: '/users/sign_in',
                headers: {
                    'X-Datalogger': 'wizkers.io Safecast Drive app',
                }
            };
                
            // Validate the parameters!
            var params = {
                'user[email]': this.$('#username').val(),
                'user[password]': this.$('#password').val()
            };

            var post_data = httprequest.multipart(params, '');
            var post_request = httprequest.request(post_options, function (res) {
                if (this.readyState != 4) // Wait until request is done
                    return;
                var err = true;
                console.log("[Safecast log file post] API Request result", this);
                // this is the xmlhttprequest
                switch (this.status) {
                case 504: // Gateway timeout
                case 0: // Cannot connect
                    console.log('Cannot connect to Safecast');
                    self.$('#errorreason').html('Safecast is not responding');
                    self.$('#errordetail').html('Could not reach Safecast. Check your network connection or retry in a few minutes.');
                    self.$('#ErrorModal').modal();
                    $("#login").html("Login");
                    $("#login").attr('disabled', false);
                    return;
                    break;
                case 200: // success
                    console.log(this.statusText);
                    err = false;
                    break;
                default:
                    break;
                }
                console.log(res);
                if (err)
                    return;
                    
                var xml = new DOMParser().parseFromString(this.responseText, 'text/html');
                // Check if we had an error.
                // Note: after a first successful login, the API sets a cookie that lasts
                // for a long time and is kept in the Chrome app (or Android app) cookie store,
                // so once we're logged in, any login/pw will work until we log out. Bug on the
                // Safecast interface side, mostly.
                if ($('#show-user', xml).length == 0) {
                    self.$('#errorreason').html('Could not log you in');
                    self.$('#errordetail').html('Please check your username / password');
                    self.$('#ErrorModal').modal();
                    $("#login").html("Login");
                    $("#login").attr('disabled', false);
                    return;
                }
                
                // Very hacky, but as long as we don't have a proper way to get the
                // current user, we will have to parse the result of the page:
                var apiKey = $("#show-user dd", xml).last().text();
                console.log(apiKey);
                
                // Now, we need to create an instrument
                // Procedure:
                // 1. Ask user to turn on their bGeigie
                // 1. Ask for Bluetooth permission
                // 2. Scan for devices
                // 3. If one device called BLEBeeXXXX is detected, select it
                // 4. If no BLEBeeXXX is detected, error
                // 5. Create bGeigie instrument w/ API key + BTLE address
                require(['app/views/first_instrument'], function(view) {
                    var v = new view();
                    self.$('#first_instrument').empty().append(v.el);
                    v.setApiKey(apiKey);
                    v.render();
                    // ... and now this next view will handle the next steps.
                });

            });
            post_request.send(post_data);                

        },

        updateInstrument: function () {
            // Whenever the instrument is updated in the manager, we need to
            // re-render. In particular,the manager is usually updated after 1st rendering
            // of the home view after selecting an instrument.
            this.instrument = instrumentManager.getInstrument();

            // Before rendering, we need to properly close and unregister everything

            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.parseInput);
            linkManager.off('uniqueID', this.updateUID);

            if (this.instrumentLiveView != null)
                this.instrumentLiveView.onClose();

            if (this.instrumentNumericView != null)
                this.instrumentNumericView.onClose();

            this.currentState = 'undef';
            this.recordingState = 'undef';

            this.render();
        },

        updateOutputStatus: function (evt) {
            console.log("[Home view] Got an update from an output plugin");
            if (evt.error) {
                this.$("#outputstatus").html("Outputs Error").addClass('btn-danger').removeClass('btn-success').removeClass('btn-info')
            } else {
                this.$("#outputstatus").html("Outputs OK").addClass('btn-success').removeClass('btn-danger').removeClass('btn-info')
            }
        },

        render: function () {
            var self = this;
            console.log('Main render of Home view');
            this.$el.html(template(this.model.toJSON()));

            this.ctrlconnect = this.$('.ctrl-connect');
            this.ctrlrecord = this.$('.ctrl-record');

            // Depending on device capabilities, enable/disable "Diag view" button
            // New in 2015.11: completely hide it rather than just disable it.
            // (careful, getCaps is only defined once an instrument is loaded)
            if (instrumentManager.getCaps && instrumentManager.getCaps().indexOf("DiagDisplay") == -1) {
                this.$('.ctrl-diag').hide();
            }

            if (vizapp.type == 'server') {
                // If we're running with a backend server, we need to disable some elements
                // in case we are only a 'viewer'. This is not relevant if we're running as an app,
                // since we're always an admin there
                if (settings.get('currentUserRole') == 'viewer') {
                    this.$('#control-area button').attr('disabled', true);
                }
            }
            if (this.instrumentLiveView != null)
                this.instrumentLiveView.onClose();

            if (this.instrumentNumericView != null)
                this.instrumentNumericView.onClose();

            // If we have a selected instrument, then instanciate its liveview here
            if (instrumentManager.getInstrument() != null) {
                console.log('Create the instrument live view');

                instrumentManager.getLiveDisplay({
                    model: this.instrument
                }, function (view) {
                    self.instrumentLiveView = view;
                    if (view != null) {
                        self.$('#liveview').html(view.el);
                        view.render();
                        if (linkManager.isConnected()) {
                            if (instrumentManager.getCaps().indexOf("WantReplay") > -1) {
                                console.log('[Home view] Replaying previous datapoints');
                                // Our instrument supports live view replay, so we ask for it:
                                setTimeout(function () {
                                    view.clear();
                                    linkManager.requestReplay();
                                }, 500);
                            }
                        }
                    }
                });

                // Now start the numeric display (the one on the right)
                if (instrumentManager.getCaps().indexOf("NumDisplay") >= 0) {
                    instrumentManager.getNumDisplay({
                        model: this.instrument
                    }, function (view) {
                        self.instrumentNumericView = view;
                        if (view != null) {
                            self.$('#numview').html(view.el);
                            view.render();
                        }
                    }); } else {
                        self.$('#numview').remove();
                        self.$('#home-left').removeClass('col-md-9').addClass('col-md-12');
                    }
            }

            // Don't hook the events before this point, no need!
            // and creates a race condition on buttons update as well.
            this.listenTo(linkManager, 'status', this.updatestatus);
            this.listenTo(linkManager, 'input', this.parseInput);
            this.listenTo(linkManager, 'uniqueID', this.updateUID);

            linkManager.requestStatus();
            return this;
        },

        onClose: function () {
            console.log("Home view closing...");

            this.stopListening(linkManager);
            this.stopListening(instrumentManager);

            if (this.instrumentLiveView != null) {
                this.instrumentLiveView.onClose();
                this.instrumentLiveView.remove();
            }

            if (this.instrumentNumericView != null) {
                this.instrumentNumericView.onClose();
                this.instrumentNumericView.remove();
            }

        },

        updateUID: function (uid) {
            console.log('Received a uniqueID for this instrument: ' + uid);
            this.instrumentUniqueID = uid;
            var savedUID = this.instrument.get('uuid');
            console.log('Our instrument type is ' + this.instrument.get('type'));
            if (savedUID == "") {
                this.instrument.set('uuid', uid);
                this.instrument.save();
            } else
            if (savedUID != uid) {
                //alert("Oops, this is a new instrument of the same model, please create another entry in the instruments screen");
            }
            // Now, we are sure our instrument is linked to a UID, so we are able to save logs
            // in our backend database, that are uniquely linked to this instrument.
        },

        ctrlDiag: function () {
            router.navigate('diagnostics/' + this.instrument.id, true);
        },

        parseInput: function (data) {
            if (data.openerror) {
                // Reset the currentStatus to make sure our buttons get back to the
                // correct state
                this.currentState = 'error';
                // Give feedback to the user on why we could not open the device
                if (data.reason)
                    this.$('#errorreason').html(data.reason);
                if (data.description)
                    this.$('#errordetail').html(data.description);

                $('#ErrorModal').modal();
            }
        },

        // Callback every 2/3 seconds from the instrument:
        updatestatus: function (data) {
            // First of all, if we don't have an instrument, no need to update our status:
            if (this.instrument == null)
                return;

            // console.log('Home view', 'update status - ' + new Date().getSeconds());

            if (vizapp.state == 'paused') {
                return;
                /**
                cordova.plugins.backgroundMode.configure({
                        text: 'Running in background '  + ticks[this.tick++]
                    });
                if (this.tick == ticks.length)
                    this.tick = 0;
                */
            }


            // If we are just a 'viewer' in server mode, then disable all buttons.
            if (vizapp.type == 'server' && (settings.get('currentUserRole') == 'viewer')) {
                if (data.portopen && this.currentState != 'connected') {
                    this.ctrlconnect.html('<span class="glyphicon glyphicon-stop"></span>&nbsp;' +
                            this.instrument.get('name') + ' connected')
                        .removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning');
                    this.currentState = 'connected';
                } else if (this.currentState != 'idle') {
                    this.ctrlconnect.html('<span class="glyphicon glyphicon-play"></span>' +
                            this.instrument.get('name') + ' not connected')
                        .addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning');
                    this.currentState = 'idle';
                }
                return;
            }

            // Depending on port status, update our controller
            // connect button:
            if (data.portopen && this.currentState != 'connected') {
                this.ctrlconnect.html('<span class="glyphicon glyphicon-stop"></span>&nbsp;Disconnect ' + this.instrument.get('name'))
                    .removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
                this.$('.btn-enable-connected').removeAttr('disabled');
                if (vizapp.type == 'cordova')
                    cordova.plugins.backgroundMode.setDefaults({
                        title: 'Connected to ' + this.instrument.get('name')
                    });
                if (this.instrumentUniqueID == null) {
                    linkManager.getUniqueID();
                }
                this.currentState = 'connected';
            } else if (!data.portopen && this.currentState != 'idle') {
                this.ctrlconnect.html('<span class="glyphicon glyphicon-play"></span>&nbsp;Connect to ' + this.instrument.get('name'))
                    .addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
                this.$('.btn-enable-connected').attr('disabled', true);
                if (vizapp.type == 'cordova')
                    cordova.plugins.backgroundMode.setDefaults({
                        title: 'Idle.',
                    });
                this.currentState = 'idle';
            }
            if (data.recording && this.recordingState != 'recording') {
                this.ctrlrecord.html('<span class="glyphicon glyphicon-pause"></span>&nbsp;Recording').addClass('btn-success')
                    .removeClass('btn-danger').attr('disabled', false);
                this.recordingState = 'recording';
            } else if (data.recording == false && this.recordingState != 'not recording') {
                this.ctrlrecord.html('<span class="glyphicon glyphicon-download"></span>&nbsp;Record').addClass('btn-danger')
                    .removeClass('btn-success');
                this.recordingState = 'not recording';
            }

        },

        ctrlConnect: function (event) {
            var self = this;
            if (this.ctrlconnect.attr('disabled'))
                return;
            this.ctrlconnect.addClass('btn-warning')
                .removeClass('btn-success').removeClass('btn-danger').attr('disabled', true);

            var id = instrumentManager.getInstrument().id;
            if (id != null) {
                if (!linkManager.isConnected()) {
                    this.ctrlconnect.html('<span class="glyphicon glyphicon-play"></span>&nbsp;Opening...')
                    self.instrumentUniqueID = null; // Just in case we change the instrument
                    linkManager.openInstrument(id);
                } else {
                    this.ctrlconnect.html('<span class="glyphicon glyphicon-play"></span>&nbsp;Closing...')
                    if (linkManager.isStreaming())
                        linkManager.stopLiveStream();
                    linkManager.closeInstrument(id);
                }
            }
        },

        ctrlRecord: function () {
            var self = this;
            if (this.ctrlrecord.attr('disabled')) {
                return;
            }
            if (!linkManager.isRecording()) {
                $('#RecordModal').modal();
            } else {
                linkManager.stopRecording();
                if (vizapp.type == 'cordova')
                    cordova.plugins.backgroundMode.setDefaults({
                        text: 'Recording stopped.',
                    });
            }
        },

        startRecord: function () {
            var self = this;
            $('#RecordModal').modal('hide');

            var currentLogSession = new Devicelog.Log();
            currentLogSession.set('name', this.$('#recordingname').val());
            currentLogSession.set('description', this.$('#description').val());
            currentLogSession.set('logtype', 'live');
            // No need to set instrument ID, it is updated when creating the
            // log session on the server side. In Chrome mode, the log store is
            // (currently) specific to the instrument, so we don't use the ID.
            this.instrument.logs.add(currentLogSession);
            currentLogSession.save(null, {
                success: function () {
                    linkManager.startRecording(currentLogSession.id); // Tell our backend to start recording.
                    if (vizapp.type == 'cordova')
                        cordova.plugins.backgroundMode.setDefaults({
                            text: 'Recording.',
                        });
                },
                error: function (obj, err) {
                    console.log(err);
                }
            });

            this.ctrlrecord.html('<span class="glyphicon glyphicon-pause"></span>&nbsp;Recording...').addClass('btn-success')
                .removeClass('btn-danger').attr('disabled', false);
        },

    });
});
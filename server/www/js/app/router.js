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
 * The main application router.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {

    "use strict";

    var $ = require('jquery'),
        Backbone = require('backbone'),
        _ = require('underscore'),
        HeaderView = require('app/views/header');

    return Backbone.Router.extend({

        routes: {
            "": "home",
            "home": "home",
            "instruments": "listInstruments",
            "instruments/page/:page": "listInstruments",
            "instruments/add": "addInstrument",
            "instruments/:id": "instrumentDetails",
            "outputs": "listOutputs",
            "outputs/page/:page": "listOutputs",
            "outputs/add": "addOutput",
            "outputs/:id": "outputDetails",
            "workspaces": "listWorkspaces",
            "workspaces/page/:page": "listWorkspaces",
            "workspaces/add": "addWorkspace",
            "workspaces/:id": "workspaceDetails",
            "logmgt": "logmanagement",
            "devicelogs/:id": "devicelogmanagement",
            "displaylogs/:ins/:loglist": "displaylogs",
            "editlogs/:ins/:loglist": "editlogs",
            "settings": "settings",
            "diagnostics/:id": "diagnostics",
            "upgrader/:id": "upgrader",
            "profile": "profile",
            "about": "about",
        },

        currentView: null,

        switchView: function (view, skiprender) {
            skiprender = skiprender || false;
            if (this.currentView) {
                this.currentView.remove();
                if (this.currentView.onClose) {
                    this.currentView.onClose();
                }
            }
            $('#content').html(view.el);
            if (!skiprender)
                view.render();
            this.currentView = view;
        },

        initialize: function () {
            var self = this;
            console.log("Initializing application");
            this.headerView = new HeaderView();
            $('.header').html(this.headerView.el);
            // We only support user management in server mode:
            if (vizapp.type != "server")
                $('.nav .profile-menu').hide();


            _.bindAll(this, "switchView"); // switchView needs to be bound to this context when called from
            // within a callback, otherwise the "onClose" methods will never
            // be called.
            _.bindAll(this, "switchinstrument");

            // When the current instrument model changes, we need to update
            // the link manager type:
            settings.on('change:currentInstrument', function (model, insId) {
                self.switchinstrument(insId);
            });

        },

        /**
         * Switchinstrument is the only location in the application where we are
         * retrieving an instrument. Instrument models have two associated collections:
         *  - Their logs
         *  - Their outputs
         *
         *  Those two collections are nested as properties of the Instrument so that they can
         * be lazy-loaded at a later stage. Depending on our run mode, this lazy-loading can be either
         * super cheap (Chrome packaged App, Cordova), or more expensive in terms of latency (server App).
         *
         *  The strategy here is to have the Instrument model trigger the 'fetch' of its outputs and logs
         * at initialization, because even in the case of a server app, the quantity of data won't be massive,
         * it is only the log entries that can be large, and we fetch those only when needed..
         */
        switchinstrument: function (insId, closeprevious) {
            var self = this;
            if (closeprevious === undefined)
                closeprevious = true;
            console.log('New instrument ID, updating the link manager type and jumping to home screen');
            require(['app/models/instrument'], function (model) {
                var ins = new model.Instrument({
                    _id: insId
                });
                ins.fetch({
                    success: function () {
                        var type = ins.get('type');
                        console.info('New instrument type: ' + type);
                        stats.setInstrumentType(type);
                        // Now update our Instrument manager:
                        // We don't want to close instruments upon instrument change
                        // when we are in server mode, because we support multiple open
                        // instruments at the same time.
                        if (vizapp.type != "server")
                            if (closeprevious) linkManager.closeInstrument(); // Stop former link manager
                        instrumentManager.setInstrument(ins);
                        // Last, query the link manager to check the status of the port
                        // of the instrument: on a Chrome app, the result will be a closed port,
                        // but in server mode, the instrument might be open already
                        linkManager.requestStatus(insId);

                        // We need to jump to the main screen now:
                        self.navigate('/', true);
                    }
                });
            });
        },

        home: function (id) {
            var self = this;
            console.log("Switching to home view");
            stats.sendAppView('home');
            require(['app/views/home'], function (HomeView) {
                var homeView = new HomeView({
                    model: settings
                });
                self.switchView(homeView);
                self.headerView.selectMenuItem('home-menu');
            });
        },

        diagnostics: function (id) {
            var self = this;
            if (linkManager.isConnected()) {
                console.log('Switching to the instrument diagnostics view');
                stats.sendAppView('diagnostics');
                instrumentManager.getDiagDisplay({
                    model: settings
                }, function (view) {
                    self.switchView(view);
                    self.headerView.selectMenuItem('home-menu');
                });
            } else {
                this.navigate('/', true);
            }
        },

        upgrader: function (id) {
            var self = this;
            console.log('Switching to the instrument upgrader view');
            stats.sendAppView('upgrader');
            instrumentManager.getUpgrader({
                model: settings
            }, function (view) {
                self.switchView(view);
                self.headerView.selectMenuItem('home-menu');
            });
        },

        // Display all logs known for the current instrument
        logmanagement: function () {
            var self = this;
            var ins = instrumentManager.getInstrument();
            // TODO: open a screen stating we have no instrument.
            if (ins == null)
                return;
            // Initialize with the list of logs for the current device:
            var logs = ins.logs;
            logs.fetch({
                success: function () {

                    // Housekeeping: if the instrument is closed,
                    // make sure the "isrecording" flag set to false on each log
                    // (they could be still "true" if the user closed the app without
                    // closing the instrument properly
                    if (!linkManager.isRecording())
                        logs.clearRecordingFlags();

                    stats.sendAppView('logmanagement');
                    require(['app/views/logmanagement'], function (view) {
                        self.switchView(new view({
                            collection: logs
                        }));
                        self.headerView.selectMenuItem('management-menu');
                    });
                },
                error: function (msg) {
                    console.log("[logmanagement] Log fetch error: ");
                    console.log(msg);
                    console.log(logs);
                }
            });
        },

        // Display all selected logs. The list of logs is passed as the
        // view's collection
        displaylogs: function (id, loglist) {
            var self = this;
            // Loglist is a comma-separated list of log IDs
            var logarray = loglist.split(",");
            var allLogs = instrumentManager.getInstrument().logs;
            allLogs.fetch({
                success: function () {
                    var myLogs = allLogs.getLogSubset(logarray);
                    stats.sendAppView('displaylogs');
                    instrumentManager.getLogView({
                        collection: myLogs
                    }, function (view) {
                        self.switchView(view, true); // Second arg is skiprender=true to avoid rendering twice
                        // (expensive on large logs)
                    });
                }
            });
        },

        // Edit all selected logs. The list of logs is passed as the
        // view's collection
        editlogs: function (id, loglist) {
            var self = this;
            // Loglist is a comma-separated list of log IDs
            var logarray = loglist.split(",");
            var allLogs = instrumentManager.getInstrument().logs;
            allLogs.fetch({
                success: function () {
                    stats.sendAppView('editlogs');
                    var myLogs = allLogs.getLogSubset(logarray);
                    instrumentManager.getLogEditView({
                        collection: myLogs
                    }, function (view) {
                        self.switchView(view);
                    });
                }
            });
        },

        // Launch log management interface for the device. All existing logs
        // are passed to the view, so that it can easily understand whether a log
        // is already downloaded in the database or not.
        devicelogmanagement: function (id) {
            var self = this;
            if (linkManager.isConnected()) {
                var allLogs = instrumentManager.getInstrument().logs;
                allLogs.fetch({
                    success: function () {
                        stats.sendAppView('devicelogmanagement');
                        instrumentManager.getLogManagementView({
                            collection: allLogs
                        }, function (view) {
                            self.switchView(view);
                            self.headerView.selectMenuItem('management-menu');
                        });
                    }
                });
            } else {
                this.navigate('/', true);
            }

        },

        //////////
        // Instrument management
        //////////
        listInstruments: function (page) {
            var self = this;
            var p = page ? parseInt(page, 10) : 1;
            require(['app/models/instrument', 'app/views/instrument/instrumentlist'], function (model, view) {
                stats.sendAppView('listintruments');
                var instrumentList = new model.InstrumentCollection();
                instrumentList.fetch({
                    success: function () {
                        self.switchView(new view({
                            model: instrumentList,
                            page: p
                        }));
                    }
                });
                self.headerView.selectMenuItem('instrument-menu');
            });
        },

        addInstrument: function () {
            var self = this;
            require(['app/models/instrument', 'app/views/instrument/instrumentdetails'], function (model, view) {
                stats.sendAppView('addinstrument');
                var instrument = new model.Instrument();
                self.switchView(new view({
                    model: instrument
                }));
                self.headerView.selectMenuItem('instrument-menu');
            });

        },

        instrumentDetails: function (id) {
            var self = this;
            require(['app/models/instrument', 'app/views/instrument/instrumentdetails'], function (model, view) {
                stats.sendAppView('instrumentdetails');
                var instrument = new model.Instrument({
                    _id: id
                });
                instrument.fetch({
                    success: function () {
                        self.switchView(new view({
                            model: instrument
                        }));
                    }
                });
                self.headerView.selectMenuItem('instrument-menu');
            });

        },

        //////////
        // Output management
        //////////
        listOutputs: function (page) {
            var self = this;
            var p = page ? parseInt(page, 10) : 1;

            var self = this;
            var ins = instrumentManager.getInstrument();
            // TODO: open a screen stating we have no instrument defined.
            if (ins == null)
                return;
            // Initialize with the list of output for the current instrument:
            var outputs = ins.outputs;
            outputs.fetch({
                success: function () {
                    require(['app/views/output/outputlist'], function (view) {
                        stats.sendAppView('listoutputs');
                        self.switchView(new view({
                            model: outputs,
                            page: p
                        }));
                        self.headerView.selectMenuItem('output-menu');
                    });

                }
            });
        },

        addOutput: function () {
            var self = this;
            var ins = instrumentManager.getInstrument();
            if (ins == null)
                this.navigate('/', true);
            require(['app/models/output', 'app/views/output/outputdetails'], function (model, view) {
                stats.sendAppView('addoutput');
                var output = new model.Output();
                ins.outputs.add(output); // Adding the output to our instrument outputs creates its URL
                // the instrument also updates the instrumentid of the output
                self.switchView(new view({
                    model: output
                }));
                self.headerView.selectMenuItem('output-menu');
            });

        },

        outputDetails: function (id) {
            var self = this;
            var outputs = instrumentManager.getInstrument().outputs;
            outputs.fetch({
                success: function () {
                    require(['app/views/output/outputdetails'], function (view) {
                        stats.sendAppView('outputdetails');
                        var output = outputs.get(id);
                        output.fetch({
                            success: function () {
                                self.switchView(new view({
                                    model: output
                                }));
                            }
                        });
                        self.headerView.selectMenuItem('output-menu');
                    });
                }
            });

        },



        // Workspace management
        listWorkspaces: function (page) {
            var self = this;
            var p = page ? parseInt(page, 10) : 1;
            var workspaceList = new WorkspaceCollection();
            workspaceList.fetch({
                success: function () {
                    self.switchView(new WorkspaceListView({
                        model: workspaceList,
                        page: p
                    }));
                }
            });
            this.headerView.selectMenuItem('workspace-menu');

        },

        addWorkspace: function () {
            // TODO: pop up a modal to select an instrument type, and create the instrument
            var workspace = new Workspace();
            this.switchView(new WorkspaceView({
                model: workspace
            }));
            this.headerView.selectMenuItem('workspace-menu');

        },

        about: function () {
            var self = this;
            require(['app/views/about'], function (view) {
                stats.sendAppView('about');
                var aboutView = new view();
                self.switchView(aboutView);
                self.headerView.selectMenuItem('about-menu');
            });
        },

        settings: function () {
            var self = this;
            require(['app/views/settings'], function (view) {
                stats.sendAppView('settings');
                var settingsView = new view({
                    model: settings
                });
                self.switchView(settingsView);
                self.headerView.selectMenuItem('settings-menu');
            });
        },

    });

});
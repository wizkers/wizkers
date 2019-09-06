#!/bin/bash
#
# Uncomment this statement for debug echos
# DEBUG=1
USER=pi
scriptname="`basename $0`"
UDR_INSTALL_LOGFILE="/var/log/wizkers_install.log"

LOGCFG_FILES="01-wizkers.conf  wizkers"
WIZKERS_LOG_DIR="/var/log/wizkers"
SERVICE_FILES="wizkers.service "

function dbgecho { if [ ! -z "$DEBUG" ] ; then echo "$*"; fi }

# ===== function DiffFiles

function DiffFiles() {

EXITFLAG=false

for filename in `echo ${SERVICE_FILES}` ; do

# Check if file exists.
   if [ -f "/etc/systemd/system/$filename" ] ; then
      dbgecho "Comparing $filename"
      diff -s sysd/$filename /etc/systemd/system/$filename
   else
      echo "file /etc/systemd/system/$filename DOES NOT EXIST"
   fi
done

# Check the 2 log config files

filename="01-wizkers.conf"
# Check if file exists.
   if [ -f "/etc/rsyslog.d/$filename" ] ; then
      dbgecho "Comparing $filename"
      diff -s logcfg/$filename /etc/rsyslog.d/$filename
   else
      echo "file /etc/rsyslog.d/$filename DOES NOT EXIST"
   fi

filename="wizkers"
# Check if file exists.
   if [  -f "/etc/logrotate.d/$filename" ] ; then
      dbgecho "Comparing $filename"
      diff -s logcfg/$filename /etc/logrotate.d/$filename
   else
      echo "file /etc/logrotate.d/$filename DOES NOT EXIST"
   fi

echo "FINISHED comparing files"

}

# ===== function CopyFiles

function CopyFiles() {

# Be sure we're running as root
if (( `id -u` != 0 )); then
   echo "Sorry, must be root.  Exiting...";
   exit 1;
fi

echo "copy systemd service files ..."
cp -u sysd/* /etc/systemd/system/

echo "copy log cfg files ..."

#-- creates /var/log/wizkers, if not exists
if [ ! -d "${WIZKERS_LOG_DIR}" ] ; then
   echo "Create wizkers log directory: $WIZKERS_LOG_DIR"
   mkdir -p "$WIZKERS_LOG_DIR"
fi

cp logcfg/01-wizkers.conf /etc/rsyslog.d/
cp logcfg/wizkers /etc/logrotate.d/

echo "restart syslog"
service rsyslog restart

echo "test log rotate for wizkers, view status before ..."

grep wizkers /var/lib/logrotate/status
logrotate -v -f /etc/logrotate.d/wizkers

echo "test log rotate, view status after ..."
grep wizkers /var/lib/logrotate/status

echo
echo "FINISHED copying files"
}

# ==== main

echo
echo "systemd install START"

# Be sure we're running as root
if [[ $EUID != 0 ]] ; then
   echo "Must be root to install."
   exit 1
fi

#if [ -z "$1" ] ; then
#   echo "No args found just copy files"
#   CopyFiles
#   exit 0
#fi

# if there are any args on command line just diff files

if (( $# != 0 )) ; then
   echo "Found $# args on command line: $1"
   echo "Just diff'ing files"
   DiffFiles
   exit 0
fi

CopyFiles

echo "$(date "+%Y %m %d %T %Z"): $scriptname: systemd install script FINISHED" >> $UDR_INSTALL_LOGFILE
echo
echo "systemd install script FINISHED"
echo

#!/usr/bin/env bash
set -e

SFTP_IMAGE="atmoz/sftp:alpine-3.6"
SFTP_CONTAINER="managed-sftp-devtest-server"

SFTP_USER=convoy
SFTP_PASSWORD=foobar
SFTP_SERVER_FOLDER=boop
SFTP_SERVER_PORT=9022
HOST_FOLDER=`pwd`/ftpstuff

announce() { >&2 echo $1; }

relaunch() {
  local name=$1
  local ALIVE=`docker ps -f name=$name -f status=running -q`
  local STOPPED=`docker ps -f name=$name -f status=exited -q`
  if [[ -n $STOPPED ]]; then
    announce "Restarting stopped $name container ID $STOPPED ('docker rm $STOPPED' to force a fresh copy)"
    docker start $STOPPED > /dev/null 2>&1
    echo 0
  elif [[ -n $ALIVE ]]; then
    announce "$name container is running, ID $ALIVE"
    echo 0
  else
    # could not relaunch
    echo 1
  fi
}

if [[ "$(relaunch $SFTP_CONTAINER)" -ne "0" ]]; then
  announce "Starting new SFTP container $SFTP_CONTAINER, mounting folder to $HOST_FOLDER"
  mkdir $HOST_FOLDER
  chmod 777 $HOST_FOLDER
  docker run -d \
    --name $SFTP_CONTAINER \
    -p $SFTP_SERVER_PORT:22 \
    -v $HOST_FOLDER:/home/$SFTP_USER/$SFTP_SERVER_FOLDER \
    $SFTP_IMAGE \
    $SFTP_USER:$SFTP_PASSWORD
fi

announce "All done"

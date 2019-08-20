#!/bin/bash     
angular_path="./cta-tracker/"
ng_build_cmd="ng build --prod"
ng_build_path="./cta-tracker/dist/cta-tracker/"
node_public_path="node/public/"

cd ${angular_path}

printf '\nStarting ng build\n' &&
${ng_build_cmd} && 
printf '\nBuild Completed\n' &&
cd .. && 
printf '\nRemoving node/public\n' &&
rm -rf ${node_public_path}* &&
printf '\nCleaned node/public\n' && 
cp -r ${ng_build_path}* ${node_public_path} &&
printf '\nMoved build to node/public\n'

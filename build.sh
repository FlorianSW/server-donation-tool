set -e

tsc
npx sass src/main.scss:dist/assets/css/main.min.css --style compressed
cp -R src/views/ dist/
cp -R src/assets dist/
cp -R node_modules/materialize-css/dist/css/materialize.min.css dist/assets/css/materialize.min.css

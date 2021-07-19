const {series, dest, src} = require('gulp');
const uglify = require('gulp-uglify');
const del = require('del');
const sass = require('gulp-sass')(require('sass'));
const rename = require('gulp-rename');
const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");

function clean() {
    return del('dist/**', {force: true});
}

function mainCss() {
    return src('src/main.scss')
        .pipe(sass({outputStyle: 'compressed'}))
        .pipe(rename('main.min.css'))
        .pipe(dest('dist/assets/css/'));
}

function views() {
    return src('src/views/**/*')
        .pipe(dest('dist/views/'));
}

function assets() {
    return src('src/assets/**/*')
        .pipe(dest('dist/assets/'));
}

function scripts() {
    return src('src/views/**/*.js')
        .pipe(uglify())
        .pipe(dest('dist/assets/js/'))
}

function materialize() {
    return src('node_modules/materialize-css/dist/css/materialize.min.css')
        .pipe(rename('materialize.min.css'))
        .pipe(dest('dist/assets/css/'));
}

function tsc() {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(dest("dist"));
}

exports.default = series(clean, tsc, mainCss, views, assets, scripts, materialize);

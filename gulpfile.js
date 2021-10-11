const {series, dest, src} = require('gulp');
const uglify = require('gulp-uglify');
const del = require('del');
const sass = require('gulp-sass')(require('sass'));
const ts = require("gulp-typescript");
const through = require("through2");
const path = require("path");
const tsProject = ts.createProject("tsconfig.json");

function clean() {
    return del('dist/**', {force: true});
}

function assets() {
    return src('src/assets/**/*')
        .pipe(dest('dist/assets/'));
}

function themes() {
    return src('themes/**/*.ejs')
        .pipe(dest('dist/themes/'));
}

function themeScripts() {
    return src('themes/**/*.js')
        .pipe(uglify())
        .pipe(dest('dist/assets/js/'));
}

function themeCss() {
    return src('themes/**/*.scss')
        .pipe(sass({outputStyle: 'compressed'}))
        .pipe(dest('dist/assets/css/'));
}

function themeAssets() {
    return src('themes/*/images/**/*')
        .pipe(removeDuplicateImagesPath())
        .pipe(dest('dist/assets/images/'));
}

function removeDuplicateImagesPath() {
    return through.obj(function (file, encoding, callback) {
        file.path = file.path.replace('images' + path.sep, '');
        callback(null, file);
    });
}

function tsc() {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(dest("dist"));
}

exports.default = series(clean, tsc, themes, assets, themeScripts, themeCss, themeAssets);

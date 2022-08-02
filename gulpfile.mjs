import {deleteSync} from 'del';
import gulp from 'gulp';
import uglify from 'gulp-uglify';
import sassCompiler from 'sass';
import gulpSass from 'gulp-sass';
import ts from 'gulp-typescript';
import through from 'through2';
import path from 'path';

const {series, dest, src} = gulp;

const sass = gulpSass(sassCompiler);
const tsProject = ts.createProject("tsconfig.json");

async function clean() {
    return deleteSync('dist/**', {force: true});
}

async function assets() {
    return src('src/assets/**/*')
        .pipe(dest('dist/assets/'));
}

async function themes() {
    return src('themes/**/*.ejs')
        .pipe(dest('dist/themes/'));
}

async function themeScripts() {
    return src('themes/**/*.js')
        .pipe(uglify())
        .pipe(dest('dist/assets/js/'));
}

async function themeCss() {
    return src('themes/**/*.scss')
        .pipe(sass({outputStyle: 'compressed'}))
        .pipe(dest('dist/assets/css/'));
}

async function themeAssets() {
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

async function tsc() {
    return tsProject.src()
        .pipe(tsProject())
        .js.pipe(dest("dist"));
}

export default series(clean, tsc, themes, assets, themeScripts, themeCss, themeAssets);

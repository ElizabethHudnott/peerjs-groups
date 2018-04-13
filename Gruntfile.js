'use strict';
module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				separator: ';'
			},
			dist: {
				src: ['src/**/*.js'],
				dest: 'dist/<%= pkg.name %>.js'
			}
		},
		uglify: {
			options: {
				banner: '//<%= pkg.name %> v<%= pkg.version %> by <%= pkg.author %>\n'
			},
			dist: {
				files: {
					'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
				}
			}
		},
	  	jshint: {
			files: ['src/**/*.js', 'test/**/*.js'],
			options: {
				curly: true,
				eqeqeq: true,
				esversion: 6,
				freeze: true,
				futurehostile: true,
				latedef: 'nofunc',
				noarg: true,
				nocomma: true,
				nonbsp: true,
				nonew: true,
				strict: true,
				undef: true,
				unused: true,
				debug: true,
				plusplus: true,
				supernew: true,
				browser: true,
				devel: true,
				typed: true,
				globals: {
					Peer: false,
					EventTarget: false
				}
			}
		},
	  	jsdoc : {
			dist : {
				src: ['src/**/*.js', 'README.md'],
				dest: 'doc',
				options: {
					pedantic: true,
				}
			}
		},
		watch: {
			files: ['<%= jshint.files %>'],
			tasks: ['build']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify-es');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-jsdoc');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('build', ['jsdoc', 'jshint', 'concat', 'uglify']);
	grunt.registerTask('default', ['build', 'watch']);
};

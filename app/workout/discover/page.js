'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPrograms, savePrograms, getActiveProgramId, setActiveProgramId,
  syncProgramsToFirestore, getPublicPrograms, PROGRAM_TYPES,
  incrementProgramCopies,
} from '../../../lib/workoutSync';
import { useAuth } from '../../../lib/AuthContext';

const C = {
  bg:'#0D0D0D', card:'#1A1A1A', card2:'#222222', border:'#2C2C2C',
  accent:'#0A84FF', accentBg:'rgba(10,132,255,0.12)',
  white:'#FFFFFF', muted:'#888888', faint:'#3A3A3A',
  success:'#30D158', successBg:'rgba(48,209,88,0.1)',
};
const font = { heading:"'Barlow Condensed', sans-serif", body:"'DM Sans', sans-serif" };

const TYPE_COLORS = {
  strength:   '#0A84FF',
  bodyweight: '#30D158',
  running:    '#FF9F0A',
  stretching: '#BF5AF2',
};

const GRAD_OPTIONS = [
  { grad: 'linear-gradient(135deg,#0a1628,#1a2744)', accent: '#0A84FF' },
  { grad: 'linear-gradient(135deg,#0a2818,#183a22)', accent: '#30D158' },
  { grad: 'linear-gradient(135deg,#280a0a,#3a1010)', accent: '#FF453A' },
  { grad: 'linear-gradient(135deg,#1a0a28,#2a1440)', accent: '#BF5AF2' },
  { grad: 'linear-gradient(135deg,#28180a,#3a2810)', accent: '#FF9F0A' },
];

// Demo programs shown when Firebase is not configured
const DEMO_PROGRAMS = [

  // ── STRENGTH ────────────────────────────────────────────────────────────────
  {
    id: 'demo-ppl',
    type: 'strength',
    name: 'Push / Pull / Legs',
    description: '5-day strength & hypertrophy split',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'demo-d1', dayNumber:1, name:'Chest & Triceps', exercises:[
        { id:'de1', name:'Barbell Bench Press',    sets:[{type:'working',reps:'6-8',weight:'185',rest:'90'},{type:'working',reps:'6-8',weight:'185',rest:'90'},{type:'working',reps:'6-8',weight:'185',rest:'90'}]},
        { id:'de2', name:'Incline Dumbbell Press', sets:[{type:'working',reps:'10-12',weight:'70',rest:'75'},{type:'working',reps:'10-12',weight:'70',rest:'75'}]},
        { id:'de3', name:'Tricep Pushdown',        sets:[{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'drop',reps:'15',weight:'40',rest:'45'}]},
      ]},
      { id:'demo-d2', dayNumber:2, name:'Back & Biceps', exercises:[
        { id:'de4', name:'Deadlift',    sets:[{type:'working',reps:'4-6',weight:'275',rest:'120'},{type:'working',reps:'4-6',weight:'275',rest:'120'}]},
        { id:'de5', name:'Barbell Row', sets:[{type:'working',reps:'6-8',weight:'165',rest:'90'},{type:'working',reps:'6-8',weight:'165',rest:'90'}]},
        { id:'de6', name:'Barbell Curl',sets:[{type:'working',reps:'10-12',weight:'85',rest:'60'},{type:'drop',reps:'15',weight:'60',rest:'45'}]},
      ]},
      { id:'demo-d3', dayNumber:3, name:'Legs', exercises:[
        { id:'de7', name:'Back Squat',          sets:[{type:'working',reps:'5',weight:'225',rest:'120'},{type:'working',reps:'5',weight:'225',rest:'120'},{type:'working',reps:'5',weight:'225',rest:'120'}]},
        { id:'de8', name:'Romanian Deadlift',   sets:[{type:'working',reps:'8-10',weight:'185',rest:'90'},{type:'working',reps:'8-10',weight:'185',rest:'90'}]},
        { id:'de9', name:'Leg Press',           sets:[{type:'working',reps:'12-15',weight:'360',rest:'90'},{type:'drop',reps:'20',weight:'270',rest:'60'}]},
      ]},
    ],
  },

  {
    id: 'demo-ul',
    type: 'strength',
    name: 'Upper / Lower Split',
    description: '4-day intermediate strength & size program',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'ul-d1', dayNumber:1, name:'Upper — Strength', exercises:[
        { id:'ul1', name:'Barbell Bench Press',   sets:[{type:'working',reps:'4-6',weight:'195',rest:'120'},{type:'working',reps:'4-6',weight:'195',rest:'120'},{type:'working',reps:'4-6',weight:'195',rest:'120'},{type:'working',reps:'4-6',weight:'195',rest:'120'}]},
        { id:'ul2', name:'Overhead Press',        sets:[{type:'working',reps:'4-6',weight:'115',rest:'120'},{type:'working',reps:'4-6',weight:'115',rest:'120'},{type:'working',reps:'4-6',weight:'115',rest:'120'}]},
        { id:'ul3', name:'Barbell Row',           sets:[{type:'working',reps:'4-6',weight:'175',rest:'120'},{type:'working',reps:'4-6',weight:'175',rest:'120'},{type:'working',reps:'4-6',weight:'175',rest:'120'},{type:'working',reps:'4-6',weight:'175',rest:'120'}]},
        { id:'ul4', name:'Pull-ups',              sets:[{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'}]},
        { id:'ul5', name:'Dumbbell Curl',         sets:[{type:'working',reps:'10',weight:'40',rest:'60'},{type:'working',reps:'10',weight:'40',rest:'60'},{type:'working',reps:'10',weight:'40',rest:'60'}]},
      ]},
      { id:'ul-d2', dayNumber:2, name:'Lower — Strength', exercises:[
        { id:'ul6',  name:'Back Squat',           sets:[{type:'working',reps:'4-6',weight:'235',rest:'180'},{type:'working',reps:'4-6',weight:'235',rest:'180'},{type:'working',reps:'4-6',weight:'235',rest:'180'},{type:'working',reps:'4-6',weight:'235',rest:'180'}]},
        { id:'ul7',  name:'Deadlift',             sets:[{type:'working',reps:'4-6',weight:'295',rest:'180'},{type:'working',reps:'4-6',weight:'295',rest:'180'},{type:'working',reps:'4-6',weight:'295',rest:'180'}]},
        { id:'ul8',  name:'Leg Press',            sets:[{type:'working',reps:'8-10',weight:'380',rest:'90'},{type:'working',reps:'8-10',weight:'380',rest:'90'},{type:'working',reps:'8-10',weight:'380',rest:'90'}]},
        { id:'ul9',  name:'Leg Curl',             sets:[{type:'working',reps:'10-12',weight:'110',rest:'75'},{type:'working',reps:'10-12',weight:'110',rest:'75'},{type:'working',reps:'10-12',weight:'110',rest:'75'}]},
        { id:'ul10', name:'Standing Calf Raise',  sets:[{type:'working',reps:'15',weight:'135',rest:'60'},{type:'working',reps:'15',weight:'135',rest:'60'},{type:'working',reps:'15',weight:'135',rest:'60'},{type:'drop',reps:'20',weight:'90',rest:'45'}]},
      ]},
      { id:'ul-d3', dayNumber:3, name:'Upper — Volume', exercises:[
        { id:'ul11', name:'Incline DB Press',     sets:[{type:'working',reps:'10-12',weight:'70',rest:'75'},{type:'working',reps:'10-12',weight:'70',rest:'75'},{type:'working',reps:'10-12',weight:'70',rest:'75'},{type:'working',reps:'10-12',weight:'70',rest:'75'}]},
        { id:'ul12', name:'Seated Cable Row',     sets:[{type:'working',reps:'12-15',weight:'130',rest:'75'},{type:'working',reps:'12-15',weight:'130',rest:'75'},{type:'working',reps:'12-15',weight:'130',rest:'75'},{type:'working',reps:'12-15',weight:'130',rest:'75'}]},
        { id:'ul13', name:'DB Lateral Raise',     sets:[{type:'working',reps:'15',weight:'25',rest:'60'},{type:'working',reps:'15',weight:'25',rest:'60'},{type:'working',reps:'15',weight:'25',rest:'60'},{type:'drop',reps:'20',weight:'15',rest:'45'}]},
        { id:'ul14', name:'Tricep Pushdown',      sets:[{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'working',reps:'12-15',weight:'55',rest:'60'}]},
        { id:'ul15', name:'Hammer Curl',          sets:[{type:'working',reps:'12',weight:'35',rest:'60'},{type:'working',reps:'12',weight:'35',rest:'60'},{type:'working',reps:'12',weight:'35',rest:'60'}]},
      ]},
      { id:'ul-d4', dayNumber:4, name:'Lower — Volume', exercises:[
        { id:'ul16', name:'Front Squat',          sets:[{type:'working',reps:'8-10',weight:'155',rest:'120'},{type:'working',reps:'8-10',weight:'155',rest:'120'},{type:'working',reps:'8-10',weight:'155',rest:'120'},{type:'working',reps:'8-10',weight:'155',rest:'120'}]},
        { id:'ul17', name:'Romanian Deadlift',    sets:[{type:'working',reps:'10-12',weight:'175',rest:'90'},{type:'working',reps:'10-12',weight:'175',rest:'90'},{type:'working',reps:'10-12',weight:'175',rest:'90'},{type:'working',reps:'10-12',weight:'175',rest:'90'}]},
        { id:'ul18', name:'Walking Lunges',       sets:[{type:'working',reps:'12',weight:'40',rest:'75'},{type:'working',reps:'12',weight:'40',rest:'75'},{type:'working',reps:'12',weight:'40',rest:'75'}]},
        { id:'ul19', name:'Leg Extension',        sets:[{type:'working',reps:'15',weight:'120',rest:'60'},{type:'working',reps:'15',weight:'120',rest:'60'},{type:'drop',reps:'20',weight:'90',rest:'45'}]},
        { id:'ul20', name:'Seated Calf Raise',    sets:[{type:'working',reps:'20',weight:'90',rest:'45'},{type:'working',reps:'20',weight:'90',rest:'45'},{type:'working',reps:'20',weight:'90',rest:'45'}]},
      ]},
    ],
  },

  {
    id: 'demo-5x5',
    type: 'strength',
    name: 'StrongLifts 5×5',
    description: 'Classic beginner barbell strength program',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'ss-d1', dayNumber:1, name:'Workout A', exercises:[
        { id:'ss1', name:'Back Squat',   sets:[{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'}]},
        { id:'ss2', name:'Bench Press',  sets:[{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'}]},
        { id:'ss3', name:'Barbell Row',  sets:[{type:'working',reps:'5',weight:'115',rest:'180'},{type:'working',reps:'5',weight:'115',rest:'180'},{type:'working',reps:'5',weight:'115',rest:'180'},{type:'working',reps:'5',weight:'115',rest:'180'},{type:'working',reps:'5',weight:'115',rest:'180'}]},
      ]},
      { id:'ss-d2', dayNumber:2, name:'Workout B', exercises:[
        { id:'ss4', name:'Back Squat',       sets:[{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'},{type:'working',reps:'5',weight:'135',rest:'180'}]},
        { id:'ss5', name:'Overhead Press',   sets:[{type:'working',reps:'5',weight:'85',rest:'180'},{type:'working',reps:'5',weight:'85',rest:'180'},{type:'working',reps:'5',weight:'85',rest:'180'},{type:'working',reps:'5',weight:'85',rest:'180'},{type:'working',reps:'5',weight:'85',rest:'180'}]},
        { id:'ss6', name:'Deadlift',         sets:[{type:'working',reps:'5',weight:'185',rest:'180'},{type:'working',reps:'5',weight:'185',rest:'180'},{type:'working',reps:'5',weight:'185',rest:'180'},{type:'working',reps:'5',weight:'185',rest:'180'},{type:'working',reps:'5',weight:'185',rest:'180'}]},
      ]},
    ],
  },

  {
    id: 'demo-fullbody',
    type: 'strength',
    name: 'Full Body 3×/Week',
    description: 'Simple beginner program — 3 days, big compound lifts',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'fb-d1', dayNumber:1, name:'Day A', exercises:[
        { id:'fb1', name:'Goblet Squat',      sets:[{type:'working',reps:'8-10',weight:'45',rest:'90'},{type:'working',reps:'8-10',weight:'45',rest:'90'},{type:'working',reps:'8-10',weight:'45',rest:'90'}]},
        { id:'fb2', name:'Dumbbell Press',    sets:[{type:'working',reps:'10-12',weight:'45',rest:'75'},{type:'working',reps:'10-12',weight:'45',rest:'75'},{type:'working',reps:'10-12',weight:'45',rest:'75'}]},
        { id:'fb3', name:'Dumbbell Row',      sets:[{type:'working',reps:'10-12',weight:'45',rest:'75'},{type:'working',reps:'10-12',weight:'45',rest:'75'},{type:'working',reps:'10-12',weight:'45',rest:'75'}]},
        { id:'fb4', name:'Glute Bridge',      sets:[{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'}]},
      ]},
      { id:'fb-d2', dayNumber:2, name:'Day B', exercises:[
        { id:'fb5', name:'Romanian Deadlift', sets:[{type:'working',reps:'8-10',weight:'95',rest:'90'},{type:'working',reps:'8-10',weight:'95',rest:'90'},{type:'working',reps:'8-10',weight:'95',rest:'90'}]},
        { id:'fb6', name:'Overhead Press',    sets:[{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'}]},
        { id:'fb7', name:'Lat Pulldown',      sets:[{type:'working',reps:'10-12',weight:'100',rest:'75'},{type:'working',reps:'10-12',weight:'100',rest:'75'},{type:'working',reps:'10-12',weight:'100',rest:'75'}]},
        { id:'fb8', name:'Plank',             sets:[{type:'working',reps:'30s',weight:'BW',rest:'45'},{type:'working',reps:'30s',weight:'BW',rest:'45'},{type:'working',reps:'30s',weight:'BW',rest:'45'}]},
      ]},
      { id:'fb-d3', dayNumber:3, name:'Day C', exercises:[
        { id:'fb9',  name:'Leg Press',          sets:[{type:'working',reps:'12-15',weight:'180',rest:'90'},{type:'working',reps:'12-15',weight:'180',rest:'90'},{type:'working',reps:'12-15',weight:'180',rest:'90'}]},
        { id:'fb10', name:'Incline DB Press',   sets:[{type:'working',reps:'10-12',weight:'40',rest:'75'},{type:'working',reps:'10-12',weight:'40',rest:'75'},{type:'working',reps:'10-12',weight:'40',rest:'75'}]},
        { id:'fb11', name:'Cable Row',          sets:[{type:'working',reps:'12',weight:'100',rest:'75'},{type:'working',reps:'12',weight:'100',rest:'75'},{type:'working',reps:'12',weight:'100',rest:'75'}]},
        { id:'fb12', name:'Dumbbell Curl',      sets:[{type:'working',reps:'12',weight:'25',rest:'60'},{type:'working',reps:'12',weight:'25',rest:'60'}]},
        { id:'fb13', name:'Tricep Overhead Ext',sets:[{type:'working',reps:'12',weight:'30',rest:'60'},{type:'working',reps:'12',weight:'30',rest:'60'}]},
      ]},
    ],
  },

  {
    id: 'demo-hypertrophy',
    type: 'strength',
    name: 'Hypertrophy Bro Split',
    description: '5-day body-part split for maximum muscle size',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'hy-d1', dayNumber:1, name:'Chest', exercises:[
        { id:'hy1', name:'Flat Barbell Bench',    sets:[{type:'working',reps:'8-10',weight:'185',rest:'90'},{type:'working',reps:'8-10',weight:'185',rest:'90'},{type:'working',reps:'8-10',weight:'185',rest:'90'},{type:'working',reps:'8-10',weight:'185',rest:'90'}]},
        { id:'hy2', name:'Incline DB Press',      sets:[{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'}]},
        { id:'hy3', name:'Cable Fly',             sets:[{type:'working',reps:'15',weight:'30',rest:'60'},{type:'working',reps:'15',weight:'30',rest:'60'},{type:'drop',reps:'20',weight:'20',rest:'45'}]},
        { id:'hy4', name:'Push-ups',              sets:[{type:'amrap',reps:'∞',weight:'BW',rest:'60'},{type:'amrap',reps:'∞',weight:'BW',rest:'60'}]},
      ]},
      { id:'hy-d2', dayNumber:2, name:'Back', exercises:[
        { id:'hy5', name:'Deadlift',              sets:[{type:'working',reps:'6-8',weight:'265',rest:'150'},{type:'working',reps:'6-8',weight:'265',rest:'150'},{type:'working',reps:'6-8',weight:'265',rest:'150'}]},
        { id:'hy6', name:'Lat Pulldown',          sets:[{type:'working',reps:'10-12',weight:'140',rest:'90'},{type:'working',reps:'10-12',weight:'140',rest:'90'},{type:'working',reps:'10-12',weight:'140',rest:'90'},{type:'working',reps:'10-12',weight:'140',rest:'90'}]},
        { id:'hy7', name:'Seated Cable Row',      sets:[{type:'working',reps:'12',weight:'140',rest:'75'},{type:'working',reps:'12',weight:'140',rest:'75'},{type:'working',reps:'12',weight:'140',rest:'75'}]},
        { id:'hy8', name:'Face Pull',             sets:[{type:'working',reps:'20',weight:'40',rest:'60'},{type:'working',reps:'20',weight:'40',rest:'60'},{type:'working',reps:'20',weight:'40',rest:'60'}]},
      ]},
      { id:'hy-d3', dayNumber:3, name:'Shoulders', exercises:[
        { id:'hy9',  name:'Seated DB Press',      sets:[{type:'working',reps:'10-12',weight:'55',rest:'90'},{type:'working',reps:'10-12',weight:'55',rest:'90'},{type:'working',reps:'10-12',weight:'55',rest:'90'},{type:'working',reps:'10-12',weight:'55',rest:'90'}]},
        { id:'hy10', name:'DB Lateral Raise',     sets:[{type:'working',reps:'15',weight:'25',rest:'60'},{type:'working',reps:'15',weight:'25',rest:'60'},{type:'working',reps:'15',weight:'25',rest:'60'},{type:'drop',reps:'20',weight:'15',rest:'45'}]},
        { id:'hy11', name:'DB Front Raise',       sets:[{type:'working',reps:'12',weight:'20',rest:'60'},{type:'working',reps:'12',weight:'20',rest:'60'},{type:'working',reps:'12',weight:'20',rest:'60'}]},
        { id:'hy12', name:'Rear Delt Fly',        sets:[{type:'working',reps:'15',weight:'20',rest:'60'},{type:'working',reps:'15',weight:'20',rest:'60'},{type:'working',reps:'15',weight:'20',rest:'60'}]},
      ]},
      { id:'hy-d4', dayNumber:4, name:'Arms', exercises:[
        { id:'hy13', name:'Barbell Curl',         sets:[{type:'working',reps:'8-10',weight:'85',rest:'75'},{type:'working',reps:'8-10',weight:'85',rest:'75'},{type:'working',reps:'8-10',weight:'85',rest:'75'},{type:'working',reps:'8-10',weight:'85',rest:'75'}]},
        { id:'hy14', name:'Incline DB Curl',      sets:[{type:'working',reps:'12',weight:'30',rest:'60'},{type:'working',reps:'12',weight:'30',rest:'60'},{type:'working',reps:'12',weight:'30',rest:'60'}]},
        { id:'hy15', name:'Tricep Pushdown',      sets:[{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'working',reps:'12-15',weight:'55',rest:'60'},{type:'working',reps:'12-15',weight:'55',rest:'60'}]},
        { id:'hy16', name:'Skull Crushers',       sets:[{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'},{type:'working',reps:'10-12',weight:'65',rest:'75'}]},
        { id:'hy17', name:'Hammer Curl',          sets:[{type:'working',reps:'12',weight:'35',rest:'60'},{type:'drop',reps:'15',weight:'25',rest:'45'}]},
      ]},
      { id:'hy-d5', dayNumber:5, name:'Legs', exercises:[
        { id:'hy18', name:'Back Squat',           sets:[{type:'working',reps:'8-10',weight:'205',rest:'120'},{type:'working',reps:'8-10',weight:'205',rest:'120'},{type:'working',reps:'8-10',weight:'205',rest:'120'},{type:'working',reps:'8-10',weight:'205',rest:'120'}]},
        { id:'hy19', name:'Romanian Deadlift',    sets:[{type:'working',reps:'10-12',weight:'175',rest:'90'},{type:'working',reps:'10-12',weight:'175',rest:'90'},{type:'working',reps:'10-12',weight:'175',rest:'90'}]},
        { id:'hy20', name:'Leg Press',            sets:[{type:'working',reps:'12-15',weight:'360',rest:'90'},{type:'working',reps:'12-15',weight:'360',rest:'90'},{type:'drop',reps:'20',weight:'270',rest:'60'}]},
        { id:'hy21', name:'Leg Curl',             sets:[{type:'working',reps:'12',weight:'110',rest:'75'},{type:'working',reps:'12',weight:'110',rest:'75'},{type:'working',reps:'12',weight:'110',rest:'75'}]},
        { id:'hy22', name:'Standing Calf Raise',  sets:[{type:'working',reps:'20',weight:'135',rest:'45'},{type:'working',reps:'20',weight:'135',rest:'45'},{type:'working',reps:'20',weight:'135',rest:'45'},{type:'drop',reps:'25',weight:'90',rest:'30'}]},
      ]},
    ],
  },

  // ── BODYWEIGHT ───────────────────────────────────────────────────────────────
  {
    id: 'demo-bw',
    type: 'bodyweight',
    name: 'Bodyweight Builder',
    description: 'Full body calisthenics, no equipment needed',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'demo-bw1', dayNumber:1, name:'Push', exercises:[
        { id:'bw1', name:'Push-ups',              sets:[{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'amrap',reps:'∞',weight:'BW',rest:'60'}]},
        { id:'bw2', name:'Pike Push-ups',         sets:[{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'}]},
        { id:'bw3', name:'Tricep Dips',           sets:[{type:'working',reps:'12',weight:'BW',rest:'60'},{type:'amrap',reps:'∞',weight:'BW',rest:'60'}]},
      ]},
      { id:'demo-bw2', dayNumber:2, name:'Pull', exercises:[
        { id:'bw4', name:'Pull-ups',              sets:[{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'},{type:'amrap',reps:'∞',weight:'BW',rest:'90'}]},
        { id:'bw5', name:'Chin-ups',              sets:[{type:'working',reps:'8',weight:'BW',rest:'75'},{type:'working',reps:'8',weight:'BW',rest:'75'}]},
        { id:'bw6', name:'Inverted Rows',         sets:[{type:'working',reps:'12',weight:'BW',rest:'60'},{type:'working',reps:'12',weight:'BW',rest:'60'}]},
      ]},
      { id:'demo-bw3', dayNumber:3, name:'Legs & Core', exercises:[
        { id:'bw7', name:'Squats',                sets:[{type:'working',reps:'20',weight:'BW',rest:'60'},{type:'working',reps:'20',weight:'BW',rest:'60'}]},
        { id:'bw8', name:'Bulgarian Split Squats',sets:[{type:'working',reps:'12',weight:'BW',rest:'75'},{type:'working',reps:'12',weight:'BW',rest:'75'}]},
        { id:'bw9', name:'Plank',                 sets:[{type:'working',reps:'60s',weight:'BW',rest:'45'},{type:'amrap',reps:'∞',weight:'BW',rest:'45'}]},
      ]},
    ],
  },

  {
    id: 'demo-bw-beginner',
    type: 'bodyweight',
    name: 'Beginner Bodyweight',
    description: 'Zero experience needed — build strength from scratch',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'bb-d1', dayNumber:1, name:'Push & Core', exercises:[
        { id:'bb1', name:'Knee Push-ups',         sets:[{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'}]},
        { id:'bb2', name:'Wall Push-ups',         sets:[{type:'working',reps:'15',weight:'BW',rest:'45'},{type:'working',reps:'15',weight:'BW',rest:'45'}]},
        { id:'bb3', name:'Chair Tricep Dips',     sets:[{type:'working',reps:'8',weight:'BW',rest:'60'},{type:'working',reps:'8',weight:'BW',rest:'60'}]},
        { id:'bb4', name:'Dead Bug',              sets:[{type:'working',reps:'8',weight:'BW',rest:'45'},{type:'working',reps:'8',weight:'BW',rest:'45'},{type:'working',reps:'8',weight:'BW',rest:'45'}]},
      ]},
      { id:'bb-d2', dayNumber:2, name:'Pull & Core', exercises:[
        { id:'bb5', name:'Dead Hang',             sets:[{type:'working',reps:'20s',weight:'BW',rest:'60'},{type:'working',reps:'20s',weight:'BW',rest:'60'},{type:'working',reps:'20s',weight:'BW',rest:'60'}]},
        { id:'bb6', name:'Inverted Row (feet down)',sets:[{type:'working',reps:'8',weight:'BW',rest:'75'},{type:'working',reps:'8',weight:'BW',rest:'75'},{type:'working',reps:'8',weight:'BW',rest:'75'}]},
        { id:'bb7', name:'Superman Hold',         sets:[{type:'working',reps:'30s',weight:'BW',rest:'45'},{type:'working',reps:'30s',weight:'BW',rest:'45'}]},
        { id:'bb8', name:'Hollow Body Hold',      sets:[{type:'working',reps:'20s',weight:'BW',rest:'45'},{type:'working',reps:'20s',weight:'BW',rest:'45'}]},
      ]},
      { id:'bb-d3', dayNumber:3, name:'Lower Body', exercises:[
        { id:'bb9',  name:'Bodyweight Squat',     sets:[{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'},{type:'working',reps:'15',weight:'BW',rest:'60'}]},
        { id:'bb10', name:'Reverse Lunge',        sets:[{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'},{type:'working',reps:'10',weight:'BW',rest:'60'}]},
        { id:'bb11', name:'Glute Bridge',         sets:[{type:'working',reps:'15',weight:'BW',rest:'45'},{type:'working',reps:'15',weight:'BW',rest:'45'},{type:'working',reps:'15',weight:'BW',rest:'45'}]},
        { id:'bb12', name:'Wall Sit',             sets:[{type:'working',reps:'30s',weight:'BW',rest:'60'},{type:'working',reps:'30s',weight:'BW',rest:'60'}]},
      ]},
    ],
  },

  {
    id: 'demo-hiit',
    type: 'bodyweight',
    name: 'HIIT Circuits',
    description: 'High-intensity fat-burning workouts, no equipment',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'hc-d1', dayNumber:1, name:'Full Body Blast', exercises:[
        { id:'hc1', name:'Burpees',               sets:[{type:'working',reps:'10',weight:'BW',rest:'30'},{type:'working',reps:'10',weight:'BW',rest:'30'},{type:'working',reps:'10',weight:'BW',rest:'30'},{type:'working',reps:'10',weight:'BW',rest:'30'}]},
        { id:'hc2', name:'Jump Squats',           sets:[{type:'working',reps:'15',weight:'BW',rest:'30'},{type:'working',reps:'15',weight:'BW',rest:'30'},{type:'working',reps:'15',weight:'BW',rest:'30'},{type:'working',reps:'15',weight:'BW',rest:'30'}]},
        { id:'hc3', name:'Mountain Climbers',     sets:[{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'}]},
        { id:'hc4', name:'Push-ups',              sets:[{type:'amrap',reps:'∞',weight:'BW',rest:'45'},{type:'amrap',reps:'∞',weight:'BW',rest:'45'},{type:'amrap',reps:'∞',weight:'BW',rest:'45'}]},
      ]},
      { id:'hc-d2', dayNumber:2, name:'Core Blaster', exercises:[
        { id:'hc5', name:'Plank',                 sets:[{type:'working',reps:'45s',weight:'BW',rest:'20'},{type:'working',reps:'45s',weight:'BW',rest:'20'},{type:'working',reps:'45s',weight:'BW',rest:'20'}]},
        { id:'hc6', name:'Bicycle Crunches',      sets:[{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'}]},
        { id:'hc7', name:'V-ups',                 sets:[{type:'working',reps:'12',weight:'BW',rest:'30'},{type:'working',reps:'12',weight:'BW',rest:'30'},{type:'working',reps:'12',weight:'BW',rest:'30'}]},
        { id:'hc8', name:'Flutter Kicks',         sets:[{type:'working',reps:'30s',weight:'BW',rest:'30'},{type:'working',reps:'30s',weight:'BW',rest:'30'},{type:'working',reps:'30s',weight:'BW',rest:'30'}]},
        { id:'hc9', name:'Russian Twists',        sets:[{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'},{type:'working',reps:'20',weight:'BW',rest:'30'}]},
      ]},
      { id:'hc-d3', dayNumber:3, name:'Tabata Cardio', exercises:[
        { id:'hc10', name:'High Knees',           sets:[{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'}]},
        { id:'hc11', name:'Jump Lunges',          sets:[{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'}]},
        { id:'hc12', name:'Squat Jumps',          sets:[{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'},{type:'working',reps:'20s',weight:'BW',rest:'10'}]},
      ]},
    ],
  },

  // ── RUNNING ──────────────────────────────────────────────────────────────────
  {
    id: 'demo-run',
    type: 'running',
    name: '5K Training Plan',
    description: '4-week beginner running program',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'demo-r1', dayNumber:1, name:'Easy Run', exercises:[
        { id:'r1', name:'Warm Up Walk', sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'r2', name:'Easy Jog',     sets:[{distance:'2',pace:'10:00',rest:'0'}]},
        { id:'r3', name:'Cool Down Walk',sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
      { id:'demo-r2', dayNumber:2, name:'Intervals', exercises:[
        { id:'r4', name:'Warm Up',        sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
        { id:'r5', name:'Fast Intervals', sets:[{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'},{distance:'0.25',pace:'8:00',rest:'120'}]},
        { id:'r6', name:'Cool Down',      sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
      ]},
      { id:'demo-r3', dayNumber:3, name:'Long Run', exercises:[
        { id:'r7', name:'Long Easy Run',  sets:[{distance:'3.1',pace:'10:30',rest:'0'}]},
      ]},
    ],
  },

  {
    id: 'demo-c25k',
    type: 'running',
    name: 'Couch to 5K',
    description: 'Walk/run intervals for absolute beginners',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'c25-d1', dayNumber:1, name:'Run/Walk Intervals', exercises:[
        { id:'c1', name:'Warm Up Walk',            sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'c2', name:'Run 1 min / Walk 90s × 8',sets:[{distance:'1.25',pace:'12:00',rest:'0'}]},
        { id:'c3', name:'Cool Down Walk',          sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
      { id:'c25-d2', dayNumber:2, name:'Longer Intervals', exercises:[
        { id:'c4', name:'Warm Up Walk',            sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'c5', name:'Run 2 min / Walk 1 min × 6',sets:[{distance:'1.5',pace:'11:30',rest:'0'}]},
        { id:'c6', name:'Cool Down Walk',          sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
      { id:'c25-d3', dayNumber:3, name:'Continuous Easy Run', exercises:[
        { id:'c7', name:'Warm Up Walk',            sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'c8', name:'Continuous Jog',          sets:[{distance:'2',pace:'11:00',rest:'0'}]},
        { id:'c9', name:'Cool Down Walk',          sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
    ],
  },

  {
    id: 'demo-10k',
    type: 'running',
    name: '10K Training Plan',
    description: '5-week intermediate running program',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'10k-d1', dayNumber:1, name:'Easy Run', exercises:[
        { id:'10k1', name:'Warm Up Walk',           sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
        { id:'10k2', name:'Easy Pace Run',          sets:[{distance:'4',pace:'10:00',rest:'0'}]},
        { id:'10k3', name:'Cool Down Walk',         sets:[{distance:'0.25',pace:'15:00',rest:'0'}]},
      ]},
      { id:'10k-d2', dayNumber:2, name:'Tempo Run', exercises:[
        { id:'10k4', name:'Easy Warm Up',           sets:[{distance:'1',pace:'10:30',rest:'0'}]},
        { id:'10k5', name:'Tempo Pace',             sets:[{distance:'3',pace:'8:30',rest:'0'}]},
        { id:'10k6', name:'Easy Cool Down',         sets:[{distance:'1',pace:'10:30',rest:'0'}]},
      ]},
      { id:'10k-d3', dayNumber:3, name:'Speed Work', exercises:[
        { id:'10k7', name:'Warm Up',                sets:[{distance:'0.5',pace:'10:00',rest:'0'}]},
        { id:'10k8', name:'Speed Repeats 800m',     sets:[{distance:'0.5',pace:'7:30',rest:'180'},{distance:'0.5',pace:'7:30',rest:'180'},{distance:'0.5',pace:'7:30',rest:'180'},{distance:'0.5',pace:'7:30',rest:'180'},{distance:'0.5',pace:'7:30',rest:'180'},{distance:'0.5',pace:'7:30',rest:'180'}]},
        { id:'10k9', name:'Cool Down',              sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
      ]},
      { id:'10k-d4', dayNumber:4, name:'Long Run', exercises:[
        { id:'10k10', name:'Long Easy Run',         sets:[{distance:'7',pace:'10:30',rest:'0'}]},
      ]},
    ],
  },

  {
    id: 'demo-halfmarathon',
    type: 'running',
    name: 'Half Marathon Prep',
    description: 'Build up to 13.1 miles over 8 weeks',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'hm-d1', dayNumber:1, name:'Recovery Run', exercises:[
        { id:'hm1', name:'Easy Recovery Jog',       sets:[{distance:'3',pace:'11:00',rest:'0'}]},
      ]},
      { id:'hm-d2', dayNumber:2, name:'Tempo Run', exercises:[
        { id:'hm2', name:'Easy Warm Up',            sets:[{distance:'1',pace:'10:30',rest:'0'}]},
        { id:'hm3', name:'Comfortably Hard Pace',   sets:[{distance:'4',pace:'8:45',rest:'0'}]},
        { id:'hm4', name:'Easy Cool Down',          sets:[{distance:'1',pace:'10:30',rest:'0'}]},
      ]},
      { id:'hm-d3', dayNumber:3, name:'Mid-Week Medium', exercises:[
        { id:'hm5', name:'Warm Up',                 sets:[{distance:'0.5',pace:'10:30',rest:'0'}]},
        { id:'hm6', name:'Steady Pace Run',         sets:[{distance:'6',pace:'9:30',rest:'0'}]},
        { id:'hm7', name:'Cool Down',               sets:[{distance:'0.5',pace:'11:00',rest:'0'}]},
      ]},
      { id:'hm-d4', dayNumber:4, name:'Long Run', exercises:[
        { id:'hm8', name:'Long Easy Run',           sets:[{distance:'10',pace:'10:30',rest:'0'}]},
      ]},
    ],
  },

  // ── STRETCHING / MOBILITY ────────────────────────────────────────────────────
  {
    id: 'demo-stretch',
    type: 'stretching',
    name: 'Morning Mobility',
    description: '20-minute full body stretch routine',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'demo-s1', dayNumber:1, name:'Upper Body', exercises:[
        { id:'s1', name:'Chest Opener',     sets:[{duration:'30',sides:'both',rest:'10'},{duration:'30',sides:'both',rest:'10'}]},
        { id:'s2', name:'Shoulder Cross',   sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
        { id:'s3', name:'Neck Roll',        sets:[{duration:'20',sides:'both',rest:'10'}]},
        { id:'s4', name:'Tricep Stretch',   sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'demo-s2', dayNumber:2, name:'Lower Body', exercises:[
        { id:'s5', name:'Hip Flexor Lunge', sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'s6', name:'Hamstring Stretch',sets:[{duration:'40',sides:'each',rest:'10'},{duration:'40',sides:'each',rest:'10'}]},
        { id:'s7', name:'Pigeon Pose',      sets:[{duration:'60',sides:'each',rest:'15'},{duration:'60',sides:'each',rest:'15'}]},
        { id:'s8', name:'Calf Stretch',     sets:[{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'demo-s3', dayNumber:3, name:'Full Body Flow', exercises:[
        { id:'s9',  name:'Cat-Cow',         sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
        { id:'s10', name:'Downward Dog',    sets:[{duration:'45',sides:'both',rest:'10'},{duration:'45',sides:'both',rest:'10'}]},
        { id:'s11', name:'Spinal Twist',    sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
      ]},
    ],
  },

  {
    id: 'demo-flexibility',
    type: 'stretching',
    name: 'Full Body Flexibility',
    description: 'Deep stretching to improve range of motion',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'fl-d1', dayNumber:1, name:'Upper Body Deep Stretch', exercises:[
        { id:'fl1', name:'Doorway Chest Stretch',  sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
        { id:'fl2', name:'Lat Stretch (Doorway)',  sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'fl3', name:'Cross-Body Shoulder',    sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'fl4', name:'Overhead Tricep Stretch',sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
        { id:'fl5', name:'Wrist Flexor Stretch',   sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'fl-d2', dayNumber:2, name:'Hips & Lower Body', exercises:[
        { id:'fl6',  name:'90/90 Hip Stretch',     sets:[{duration:'60',sides:'each',rest:'15'},{duration:'60',sides:'each',rest:'15'}]},
        { id:'fl7',  name:'Pigeon Pose',           sets:[{duration:'90',sides:'each',rest:'15'},{duration:'90',sides:'each',rest:'15'}]},
        { id:'fl8',  name:'Standing Quad Stretch', sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'fl9',  name:'Seated Hamstring Stretch',sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'fl10', name:'Butterfly Stretch',     sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
      ]},
      { id:'fl-d3', dayNumber:3, name:'Spine & Full Body', exercises:[
        { id:'fl11', name:'Child\'s Pose',         sets:[{duration:'90',sides:'both',rest:'10'},{duration:'90',sides:'both',rest:'10'}]},
        { id:'fl12', name:'Cobra Stretch',         sets:[{duration:'30',sides:'both',rest:'10'},{duration:'30',sides:'both',rest:'10'},{duration:'30',sides:'both',rest:'10'}]},
        { id:'fl13', name:'Thread the Needle',     sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'fl14', name:'Supine Spinal Twist',   sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'fl15', name:'Happy Baby',            sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
      ]},
    ],
  },

  {
    id: 'demo-recovery',
    type: 'stretching',
    name: 'Post-Workout Recovery',
    description: 'Cool down and reduce soreness after hard training',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'rc-d1', dayNumber:1, name:'Upper Body Release', exercises:[
        { id:'rc1', name:'Chest & Shoulder Roll',  sets:[{duration:'45',sides:'both',rest:'10'},{duration:'45',sides:'both',rest:'10'}]},
        { id:'rc2', name:'Lat Stretch',            sets:[{duration:'40',sides:'each',rest:'10'},{duration:'40',sides:'each',rest:'10'}]},
        { id:'rc3', name:'Bicep Wall Stretch',     sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
        { id:'rc4', name:'Neck Side Stretch',      sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
        { id:'rc5', name:'Forearm Stretch',        sets:[{duration:'30',sides:'each',rest:'10'},{duration:'30',sides:'each',rest:'10'}]},
      ]},
      { id:'rc-d2', dayNumber:2, name:'Lower Body Release', exercises:[
        { id:'rc6',  name:'Hip Flexor Lunge',      sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'rc7',  name:'Quad Stretch',          sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'rc8',  name:'Hamstring Stretch',     sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'rc9',  name:'Figure-Four Glute',     sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'rc10', name:'Calf & Achilles Stretch',sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
      ]},
      { id:'rc-d3', dayNumber:3, name:'Total Body Cool Down', exercises:[
        { id:'rc11', name:'Standing Forward Fold', sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
        { id:'rc12', name:'Seated Twist',          sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'rc13', name:'Legs Up The Wall',      sets:[{duration:'120',sides:'both',rest:'10'},{duration:'120',sides:'both',rest:'10'}]},
        { id:'rc14', name:'Savasana',              sets:[{duration:'180',sides:'both',rest:'0'}]},
      ]},
    ],
  },

  {
    id: 'demo-yoga',
    type: 'stretching',
    name: 'Yoga Flow',
    description: 'Breath-linked movement for strength & calm',
    authorId: 'demo', isPublic: true,
    days: [
      { id:'yg-d1', dayNumber:1, name:'Sun Salutation Flow', exercises:[
        { id:'yg1', name:'Mountain Pose',          sets:[{duration:'30',sides:'both',rest:'5'}]},
        { id:'yg2', name:'Sun Salutation A × 5',   sets:[{duration:'120',sides:'both',rest:'10'},{duration:'120',sides:'both',rest:'10'}]},
        { id:'yg3', name:'Warrior I',              sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'yg4', name:'Warrior II',             sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'yg5', name:'Triangle Pose',          sets:[{duration:'45',sides:'each',rest:'10'},{duration:'45',sides:'each',rest:'10'}]},
        { id:'yg6', name:'Savasana',               sets:[{duration:'180',sides:'both',rest:'0'}]},
      ]},
      { id:'yg-d2', dayNumber:2, name:'Hip Opening Practice', exercises:[
        { id:'yg7',  name:'Low Lunge (Anjaneyasana)',sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'yg8',  name:'Lizard Pose',           sets:[{duration:'60',sides:'each',rest:'10'},{duration:'60',sides:'each',rest:'10'}]},
        { id:'yg9',  name:'Pigeon Pose',           sets:[{duration:'90',sides:'each',rest:'10'},{duration:'90',sides:'each',rest:'10'}]},
        { id:'yg10', name:'Frog Pose',             sets:[{duration:'60',sides:'both',rest:'10'},{duration:'60',sides:'both',rest:'10'}]},
        { id:'yg11', name:'Reclined Butterfly',    sets:[{duration:'90',sides:'both',rest:'10'},{duration:'90',sides:'both',rest:'10'}]},
      ]},
      { id:'yg-d3', dayNumber:3, name:'Restorative Yoga', exercises:[
        { id:'yg12', name:'Supported Child\'s Pose',sets:[{duration:'180',sides:'both',rest:'10'}]},
        { id:'yg13', name:'Reclined Spinal Twist', sets:[{duration:'90',sides:'each',rest:'10'}]},
        { id:'yg14', name:'Legs Up The Wall',      sets:[{duration:'180',sides:'both',rest:'10'}]},
        { id:'yg15', name:'Corpse Pose (Savasana)',sets:[{duration:'300',sides:'both',rest:'0'}]},
      ]},
    ],
  },

];

export default function DiscoverPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [publicPrograms, setPublicPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(null);
  const [myPrograms, setMyPrograms] = useState([]);
  const [firestoreStatus, setFirestoreStatus] = useState(''); // '' | 'ok' | 'unavailable'

  useEffect(() => {
    const mine = getPrograms();
    setMyPrograms(mine);

    // Always show demo programs; merge in Firestore public programs on top
    getPublicPrograms().then(remote => {
      setFirestoreStatus(remote.length >= 0 ? 'ok' : 'unavailable');
      // Merge: real published programs first, then demo fill-ins (deduplicated)
      const remoteIds = new Set(remote.map(r => r.id));
      const merged = [
        ...remote,
        ...DEMO_PROGRAMS.filter(d => !remoteIds.has(d.id)),
      ];
      setPublicPrograms(merged);
      setLoading(false);
    }).catch(() => {
      setFirestoreStatus('unavailable');
      setPublicPrograms(DEMO_PROGRAMS);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all'
    ? publicPrograms
    : publicPrograms.filter(p => p.type === filter);

  const alreadyHave = (id) => myPrograms.some(p => p.id === id || p.copiedFromId === id);

  function copyProgram(prog) {
    const newId = `prog-${Date.now()}`;
    const copy = {
      ...prog,
      id: newId,
      copiedFromId: prog.id,
      isPublic: false,
      createdAt: new Date().toISOString(),
      days: prog.days.map((d, i) => ({
        ...d,
        id: `${newId}-d${i+1}`,
        grad: GRAD_OPTIONS[i % 5].grad,
        accent: GRAD_OPTIONS[i % 5].accent,
      })),
    };
    const updated = [...myPrograms, copy];
    setMyPrograms(updated);
    savePrograms(updated);
    setActiveProgramId(newId);
    if (user) syncProgramsToFirestore(user.uid, updated);
    // Increment copy counter on the public program
    incrementProgramCopies(prog.id, 1);
    // Optimistically update local count
    setPublicPrograms(prev => prev.map(p => p.id === prog.id ? { ...p, copies: (p.copies || 0) + 1 } : p));
    setCopied(prog.id);
    setTimeout(() => setCopied(null), 2500);
  }

  function removeProgram(prog) {
    // Remove from my library
    const copiedVersion = myPrograms.find(p => p.id === prog.id || p.copiedFromId === prog.id);
    if (!copiedVersion) return;
    const updated = myPrograms.filter(p => p.id !== copiedVersion.id);
    setMyPrograms(updated);
    savePrograms(updated);
    if (user) syncProgramsToFirestore(user.uid, updated);
    // Decrement copy counter
    incrementProgramCopies(prog.id, -1);
    setPublicPrograms(prev => prev.map(p => p.id === prog.id ? { ...p, copies: Math.max(0, (p.copies || 0) - 1) } : p));
  }

  return (
    <div style={{ fontFamily:font.body, background:C.bg, minHeight:'100dvh', color:C.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        button{cursor:pointer;font-family:inherit}
      `}</style>

      {/* HEADER */}
      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:`${C.bg}ee`, backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${C.border}`,
        padding:'12px 20px', display:'flex', alignItems:'center', gap:14,
      }}>
        <button onClick={() => router.push('/workout')} style={{
          background:C.card, border:`1px solid ${C.border}`, borderRadius:10,
          padding:'8px 12px', lineHeight:0, color:C.white,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:2, marginBottom:1 }}>COMMUNITY</p>
          <h1 style={{ fontFamily:font.heading, fontWeight:900, fontSize:24, letterSpacing:2 }}>DISCOVER</h1>
        </div>
      </header>

      {/* TYPE FILTER TABS */}
      <div style={{ padding:'14px 16px 0', display:'flex', gap:8, overflowX:'auto' }}>
        {[{ id:'all', label:'All', emoji:'💥' }, ...Object.entries(PROGRAM_TYPES).map(([id, t]) => ({ id, label:t.label, emoji:t.emoji }))].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            flexShrink:0,
            background: filter === t.id ? C.accentBg : C.card,
            border:`1px solid ${filter === t.id ? 'rgba(10,132,255,0.4)' : C.border}`,
            borderRadius:20, padding:'7px 14px',
            fontSize:12, fontWeight:700,
            color: filter === t.id ? C.accent : C.muted,
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* STATUS BANNER */}
      {firestoreStatus === 'unavailable' && (
        <div style={{ margin:'12px 16px 0', background:'rgba(255,159,10,0.1)', border:'1px solid rgba(255,159,10,0.3)', borderRadius:12, padding:'10px 14px', fontSize:12, color:'#FF9F0A', lineHeight:1.5 }}>
          ⚠️ Could not load community programs — showing demo programs only. Make sure you're signed in and Firestore rules allow reads on <code>publicWorkouts</code>.
        </div>
      )}

      {/* CONTENT */}
      <main style={{ padding:'16px 16px 100px' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', border:`3px solid ${C.border}`, borderTopColor:C.accent, animation:'spin 0.8s linear infinite' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <p style={{ fontSize:15 }}>No public programs yet.</p>
            <p style={{ fontSize:13, marginTop:6 }}>Be the first to publish one!</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {filtered.map(prog => {
              const pt = PROGRAM_TYPES[prog.type || 'strength'];
              const typeColor = TYPE_COLORS[prog.type || 'strength'];
              const have = alreadyHave(prog.id);
              const justCopied = copied === prog.id;
              const totalExercises = prog.days.reduce((s, d) => s + (d.exercises?.length || 0), 0);
              const totalSets = prog.days.reduce((s, d) =>
                s + (d.exercises?.reduce((ss, e) => ss + (e.sets?.length || 0), 0) || 0), 0);
              return (
                <div key={prog.id} style={{
                  background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:20, overflow:'hidden',
                }}>
                  {/* Card header with gradient */}
                  <div style={{
                    background:`linear-gradient(135deg, ${typeColor}18, ${typeColor}08)`,
                    borderBottom:`1px solid ${C.border}`,
                    padding:'18px 18px 14px',
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          background:`${typeColor}22`, border:`1px solid ${typeColor}44`,
                          borderRadius:6, padding:'2px 8px', marginBottom:8,
                        }}>
                          <span style={{ fontSize:12 }}>{pt?.emoji}</span>
                          <span style={{ fontSize:10, fontWeight:700, color:typeColor, letterSpacing:1.5 }}>
                            {pt?.label?.toUpperCase()}
                          </span>
                        </div>
                        <h3 style={{ fontFamily:font.heading, fontWeight:900, fontSize:24, letterSpacing:0.5, color:C.white, lineHeight:1.1, marginBottom:4 }}>
                          {prog.name.toUpperCase()}
                        </h3>
                        {prog.description && (
                          <p style={{ fontSize:12, color:C.muted, lineHeight:1.4 }}>{prog.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display:'flex', gap:16, marginTop:14 }}>
                      {[
                        { v: prog.days.length, l: 'DAYS' },
                        { v: totalExercises, l: 'EXERCISES' },
                        { v: prog.copies || 0, l: 'PEOPLE ADDED', highlight: true },
                      ].map((stat, i, arr) => (
                        <div key={stat.l} style={{ display:'flex', alignItems:'stretch', gap:16 }}>
                          <div>
                            <div style={{ fontFamily:font.heading, fontWeight:900, fontSize:22, color: stat.highlight ? C.success : typeColor, lineHeight:1 }}>{stat.v}</div>
                            <div style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1.5 }}>{stat.l}</div>
                          </div>
                          {i < arr.length-1 && <div style={{ width:1, background:C.border }}/>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Days preview */}
                  <div style={{ padding:'12px 18px', display:'flex', gap:6, overflowX:'auto' }}>
                    {prog.days.map((d, i) => (
                      <div key={d.id} style={{
                        flexShrink:0,
                        background:C.card2, border:`1px solid ${C.border}`,
                        borderRadius:8, padding:'6px 10px',
                      }}>
                        <div style={{ fontSize:9, fontWeight:700, color:C.muted, letterSpacing:1 }}>DAY {d.dayNumber}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:C.white, whiteSpace:'nowrap' }}>{d.name}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{d.exercises?.length || 0} exercises</div>
                      </div>
                    ))}
                  </div>

                  {/* Copy / Remove buttons */}
                  <div style={{ padding:'0 18px 18px', display:'flex', gap:8 }}>
                    {have ? (
                      <>
                        <div style={{
                          flex:1, height:48, background:C.successBg,
                          border:`1px solid rgba(48,209,88,0.3)`,
                          borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontFamily:font.heading, fontSize:16, fontWeight:700, letterSpacing:1, color:C.success }}>IN LIBRARY</span>
                        </div>
                        <button onClick={() => removeProgram(prog)} style={{
                          width:48, height:48, borderRadius:12, flexShrink:0,
                          background:'rgba(255,69,58,0.1)', border:'1px solid rgba(255,69,58,0.3)',
                          color:'#FF453A', fontSize:20, lineHeight:1,
                          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                        }} title="Remove from my library">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                        </button>
                      </>
                    ) : (
                      <button onClick={() => copyProgram(prog)} style={{
                        flex:1, height:48,
                        background: justCopied
                          ? `linear-gradient(90deg, ${C.success}, #20b857)`
                          : `linear-gradient(90deg, ${typeColor}, ${typeColor}cc)`,
                        border:'none', borderRadius:12,
                        fontFamily:font.heading, fontSize:17, fontWeight:700, letterSpacing:1.5,
                        color:C.white, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                        transition:'all 0.3s ease',
                      }}>
                        {justCopied ? '✓ ADDED!' : '+ ADD TO MY PROGRAMS'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:50,
        background:`${C.bg}f5`, backdropFilter:'blur(20px)',
        borderTop:`1px solid ${C.border}`,
        display:'flex', justifyContent:'space-around',
        padding:'10px 0 max(10px, env(safe-area-inset-bottom))',
      }}>
        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={C.faint}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>Home</span>
        </button>
        <button onClick={() => router.push('/workout')} style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/>
            <rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.muted }}>Workout</span>
        </button>
        <button style={{ background:'none', border:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'4px 20px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <span style={{ fontSize:10, fontWeight:600, color:C.accent }}>Discover</span>
        </button>
      </nav>
    </div>
  );
}

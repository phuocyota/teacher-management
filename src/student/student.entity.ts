import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClassEntity } from '../class/class.entity.js';
import { SchoolEntity } from '../school/school.entity.js';

import { PartialType } from '@nestjs/mapped-types';
import { CreateModifierDto } from './create-modifier.dto';

export class UpdateModifierDto extends PartialType(CreateModifierDto) {}

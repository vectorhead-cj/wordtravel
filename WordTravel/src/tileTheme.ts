import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import type { RuleTile } from './engine/types';
import type { RuleFulfillment } from './engine/GameLogic';
import { colors } from './theme';
import ModifierHard from './assets/svg/modifier_hard.svg';
import ModifierSoft from './assets/svg/modifier_soft.svg';
import ModifierForbidden from './assets/svg/modifier_forbidden.svg';
import ModifierRectangle from './assets/svg/modifier_rectangle.svg';
import ModifierTriangle from './assets/svg/modifier_triangle.svg';

export type ModifierStyle = 'varied' | 'rectangle' | 'triangle';

export const MODIFIER_STYLE: ModifierStyle = 'triangle';

/** Shifts bidirectional soft/forbidden: down rule toward bottom, up rule toward top (px). Use 0 to overlap. */
export const BIDIRECTIONAL_MODIFIER_OFFSET_PX = 0;

export const TileTheme = {
  colors: {
    ruleNeutral: colors.ruleIndicatorNeutral,
    ruleBroken: colors.ruleBroken,
    hardMatch: colors.hardMatch,
    softMatch: colors.softMatch,
    forbidden: colors.forbidden,
  },
} as const;

type ModifierRuleType = Extract<RuleTile['type'], 'hardMatch' | 'softMatch' | 'forbiddenMatch'>;

function ruleFulfilledColor(rule: ModifierRuleType): string {
  if (rule === 'hardMatch') return TileTheme.colors.hardMatch;
  if (rule === 'softMatch') return TileTheme.colors.softMatch;
  return TileTheme.colors.forbidden;
}

export function resolveModifierColor(rule: ModifierRuleType, fulfillment: RuleFulfillment): string {
  if (MODIFIER_STYLE === 'rectangle' || MODIFIER_STYLE === 'triangle') {
    return ruleFulfilledColor(rule);
  }
  if (fulfillment === 'neutral') return TileTheme.colors.ruleNeutral;
  if (fulfillment === 'broken') return TileTheme.colors.ruleBroken;
  return ruleFulfilledColor(rule);
}

export function resolveModifierSource(rule: ModifierRuleType): ComponentType<SvgProps> {
  if (MODIFIER_STYLE === 'rectangle') return ModifierRectangle;
  if (MODIFIER_STYLE === 'triangle') return ModifierTriangle;
  switch (rule) {
    case 'hardMatch':
      return ModifierHard;
    case 'softMatch':
      return ModifierSoft;
    case 'forbiddenMatch':
      return ModifierForbidden;
  }
}

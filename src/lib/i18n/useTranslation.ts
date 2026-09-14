/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - i18n hook alias
 */

import { useTranslation as useTranslationOriginal } from './index.tsx';

export function useTranslation() {
  const ctx = useTranslationOriginal();
  return {
    ...ctx,
    isRtl: ctx.isRTL,
  };
}

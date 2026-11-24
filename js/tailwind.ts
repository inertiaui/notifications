// Teaches tailwind-merge the theme's own tokens, so a part class such as rounded-none replaces rounded-iui-toast.
// Colors need no entry, as tailwind-merge takes any name after bg-, text-, or border- as a color.
export const tailwindMergeConfig = {
    extend: {
        theme: {
            radius: ['iui-toast', 'iui-inbox'],
        },
    },
}

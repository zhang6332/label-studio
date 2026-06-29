import { t } from "@humansignal/core";
export default {
  enableHotkeys: {
    newUI: {
      title: t("Labeling hotkeys"),
      description: t("Enables quick selection of labels using hotkeys"),
    },
    description: "Enable labeling hotkeys",
    onChangeEvent: "toggleHotkeys",
    defaultValue: true,
  },
  enableTooltips: {
    newUI: {
      title: t("Show hotkeys on tooltips"),
      description: t("Displays keybindings on tools and actions tooltips"),
    },
    description: "Show hotkey tooltips",
    onChangeEvent: "toggleTooltips",
    checked: "",
    defaultValue: false,
  },
  enableLabelTooltips: {
    newUI: {
      title: t("Show hotkeys on labels"),
      description: t("Displays keybindings on labels"),
    },
    description: "Show labels hotkey tooltips",
    onChangeEvent: "toggleLabelTooltips",
    defaultValue: true,
  },
  showLabels: {
    newUI: {
      title: t("Show region labels"),
      description: t("Display region label names"),
    },
    description: "Show labels inside the regions",
    onChangeEvent: "toggleShowLabels",
    defaultValue: false,
  },
  continuousLabeling: {
    newUI: {
      title: t("Keep label selected after creating a region"),
      description: t("Allows continuous region creation using the selected label"),
    },
    description: t("Keep label selected after creating a region"),
    onChangeEvent: "toggleContinuousLabeling",
    defaultValue: false,
  },
  selectAfterCreate: {
    newUI: {
      title: t("Select region after creating it"),
      description: t("Automatically selects newly created regions"),
    },
    description: "Select regions after creating",
    onChangeEvent: "toggleSelectAfterCreate",
    defaultValue: false,
  },
  showLineNumbers: {
    newUI: {
      tags: "Text Tag",
      title: t("Show line numbers"),
      description: t("Identify and reference specific lines of text in your document"),
    },
    description: "Show line numbers for Text",
    onChangeEvent: "toggleShowLineNumbers",
    defaultValue: false,
  },
  preserveSelectedTool: {
    newUI: {
      tags: "Image Tag",
      title: t("Keep selected tool"),
      description: t("Persists the selected tool across tasks"),
    },
    description: "Remember Selected Tool",
    onChangeEvent: "togglepreserveSelectedTool",
    defaultValue: true,
  },
  enableSmoothing: {
    newUI: {
      tags: "Image Tag",
      title: t("Pixel smoothing on zoom"),
      description: t("Smooth image pixels when zoomed in"),
    },
    description: "Enable image smoothing when zoom",
    onChangeEvent: "toggleSmoothing",
    defaultValue: true,
  },
  invertedZoom: {
    newUI: {
      tags: "Image Tag",
      title: t("Invert zoom direction"),
      description: t("Invert the direction of scroll-to-zoom"),
    },
    description: "Enable inverted zoom direction",
    onChangeEvent: "toggleInvertedZoom",
    defaultValue: false,
  },
};

import { Ionicons } from "@expo/vector-icons";
import { deleteFolder, Folder } from "@soundx/services";
import React from "react";
import {
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

interface FolderMoreModalProps {
  visible: boolean;
  folder: Folder | null;
  onClose: () => void;
  onPlayAll: (folder: Folder) => void;
  onShowProperties: (folder: Folder) => void;
  onDeleteSuccess?: (folderId: number) => void;
}

export const FolderMoreModal: React.FC<FolderMoreModalProps> = ({
  visible,
  folder,
  onClose,
  onPlayAll,
  onShowProperties,
  onDeleteSuccess,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!folder) return null;

  const handleDelete = () => {
    Alert.alert(
      "删除文件夹",
      `确定要永久删除文件夹“${folder.name}”及其所有内容吗？这将同时从磁盘删除所有相关物理文件，此操作不可恢复。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定删除",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteFolder(folder.id);
              if (res.code === 200) {
                onDeleteSuccess?.(folder.id);
                onClose();
              }
            } catch (e) {
              console.error("Failed to delete folder", e);
              Alert.alert("错误", "删除失败，请稍后重试");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.content,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 20, width: '100%', maxWidth: 450 },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.folderName, { color: colors.text }]} numberOfLines={1}>
              {folder.name}
            </Text>
            <Text style={[styles.folderPath, { color: colors.secondary }]} numberOfLines={1}>
              {folder.path}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onPlayAll(folder);
              onClose();
            }}
          >
            <Ionicons name="play-circle-outline" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>播放全部</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onShowProperties(folder);
              onClose();
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>属性</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#ff4d4f" />
            <Text style={[styles.menuText, styles.dangerText]}>删除文件夹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 10, justifyContent: 'center' }]}
            onPress={onClose}
          >
            <Text style={[styles.menuText, { color: colors.secondary }]}>取消</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: 'center',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(150,150,150,0.1)",
    paddingBottom: 15,
  },
  folderName: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  folderPath: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
  },
  dangerText: {
    color: "#ff4d4f",
  },
});

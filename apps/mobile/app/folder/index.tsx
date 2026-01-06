import { Ionicons } from "@expo/vector-icons";
import { batchDeleteItems, Folder as FolderType, getFolderContents, getFolderRoots, getFolderStats } from "@soundx/services";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FolderMoreModal } from "../../src/components/FolderMoreModal";
import { usePlayer } from "../../src/context/PlayerContext";
import { useTheme } from "../../src/context/ThemeContext";
import { usePlayMode } from "../../src/utils/playMode";

export default function FolderRootsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = usePlayMode();
  const { playTrackList } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<FolderType[]>([]);
  
  // Layout and modal state
  const [layoutMode, setLayoutMode] = useState<"list" | "grid">("list");
  const [activeFolder, setActiveFolder] = useState<FolderType | null>(null);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<number[]>([]);

  // Adaptive Grid Calculation
  const GRID_ITEM_WIDTH = 100;
  const GRID_GAP = 12;
  const PADDING_H = 32; // 16 * 2
  
  const numColumns = Math.max(3, Math.floor((width - PADDING_H + GRID_GAP) / (GRID_ITEM_WIDTH + GRID_GAP)));
  const itemWidth = (width - PADDING_H - (numColumns - 1) * GRID_GAP) / numColumns;

  const fetchRoots = async () => {
    setLoading(true);
    try {
      const res = await getFolderRoots(mode as any);
      if (res.code === 200) {
        setFolders(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch folder roots:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoots();
  }, [mode]);

  const handleShowFolderProperties = async (folder: FolderType) => {
    try {
      const res = await getFolderStats(folder.id);
      if (res.code === 200) {
        Alert.alert(
          "文件夹属性",
          `名称: ${folder.name}\n路径: ${res.data.path}\n包含单曲: ${res.data.trackCount}\n包含文件夹: ${res.data.folderCount}`
        );
      }
    } catch (error) {
      Alert.alert("错误", "获取属性失败");
    }
  };

  const handlePlayAll = async (folder: FolderType) => {
    try {
      const res = await getFolderContents(folder.id);
      if (res.code === 200 && res.data.tracks.length > 0) {
        playTrackList(res.data.tracks, 0);
      } else {
        Alert.alert("提示", "该文件夹下没有可播放的音轨");
      }
    } catch (error) {
      Alert.alert("提示", "播放失败");
    }
  };

  const handleFolderClick = (folder: FolderType) => {
    if (isSelectionMode) {
      toggleFolderSelection(folder.id);
      return;
    }
    router.push(`/folder/${folder.id}` as any);
  };

  const toggleFolderSelection = (id: number) => {
    setSelectedFolders((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = folders.map((f) => f.id);
    if (selectedFolders.length === allIds.length) {
      setSelectedFolders([]);
    } else {
      setSelectedFolders(allIds);
    }
  };

  const handleBatchDelete = () => {
    Alert.alert(
      "确认批量删除",
      `将会物理删除选中的 ${selectedFolders.length} 个文件夹及其所有内容，此操作不可恢复。确定要继续吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定删除",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await batchDeleteItems({
                folderIds: selectedFolders,
                trackIds: [],
              });
              if (res.code === 200) {
                setIsSelectionMode(false);
                setSelectedFolders([]);
                fetchRoots();
              }
            } catch (error) {
              console.error("Batch delete failed", error);
              Alert.alert("错误", "删除失败");
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: FolderType }) => {
    const isSelected = selectedFolders.includes(item.id);

    if (layoutMode === "grid") {
      return (
        <TouchableOpacity
          style={[
            styles.gridItem, 
            { width: itemWidth },
            { backgroundColor: colors.card },
            isSelected && { backgroundColor: colors.primary + "20", borderColor: colors.primary, borderWidth: 1 }
          ]}
          onPress={() => handleFolderClick(item)}
          onLongPress={() => {
            if (isSelectionMode) return;
            setActiveFolder(item);
          }}
        >
          {isSelectionMode && (
            <View style={styles.gridCheckbox}>
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={20}
                color={isSelected ? colors.primary : colors.secondary}
              />
            </View>
          )}
          <View style={styles.gridIconContainer}>
            <View style={[styles.gridFolderIcon, { backgroundColor: colors.primary + "10" }]}>
              <Ionicons name="folder" size={48} color="#faad14" />
            </View>
          </View>
          <Text style={[styles.gridItemName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.item, 
          { backgroundColor: colors.card },
          isSelected && { backgroundColor: colors.primary + "20", borderColor: colors.primary, borderWidth: 1 }
        ]}
        onPress={() => handleFolderClick(item)}
        onLongPress={() => {
            if (isSelectionMode) return;
            setActiveFolder(item);
        }}
      >
        {isSelectionMode && (
          <View style={styles.checkbox}>
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={24}
              color={isSelected ? colors.primary : colors.secondary}
            />
          </View>
        )}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="folder" size={32} color="#faad14" />
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemPath, { color: colors.secondary }]} numberOfLines={1}>
            {item.path}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>文件夹</Text>
        <View style={styles.headerRight}>
          {!isSelectionMode && (
            <TouchableOpacity 
              onPress={() => setLayoutMode(layoutMode === "list" ? "grid" : "list")} 
              style={styles.headerButton}
            >
              <Ionicons 
                name={layoutMode === "list" ? "grid-outline" : "list-outline"} 
                size={22} 
                color={colors.text} 
              />
            </TouchableOpacity>
          )}
          {isSelectionMode ? (
            <TouchableOpacity onPress={() => setIsSelectionMode(false)} style={styles.headerButton}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>取消</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsSelectionMode(true)} style={styles.headerButton}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSelectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.barButton}>
            <Text style={{ color: colors.text }}>全选</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            已选中 {selectedFolders.length} 项
          </Text>
          <TouchableOpacity onPress={handleBatchDelete} style={styles.barButton} disabled={selectedFolders.length === 0}>
            <Text style={{ color: "#ff4d4f", fontWeight: "600" }}>删除</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          key={layoutMode + numColumns}
          numColumns={layoutMode === "grid" ? numColumns : 1}
          data={folders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={layoutMode === "grid" ? styles.gridRow : undefined}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: colors.secondary }}>暂无文件夹</Text>
            </View>
          }
        />
      )}

      <FolderMoreModal
        visible={!!activeFolder}
        folder={activeFolder}
        onClose={() => setActiveFolder(null)}
        onPlayAll={handlePlayAll}
        onShowProperties={handleShowFolderProperties}
        onDeleteSuccess={() => {
          fetchRoots();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 56,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  listContent: {
    padding: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemPath: {
    fontSize: 12,
  },
  moreButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  gridRow: {
    justifyContent: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    // width is now set dynamically via style prop
    aspectRatio: 0.8,
    padding: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gridIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  gridFolderIcon: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  gridItemName: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  gridMoreButton: {
    position: "absolute",
    top: 4,
    right: -4,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  barButton: {
    padding: 8,
  },
  checkbox: {
    marginRight: 12,
  },
  gridCheckbox: {
    position: "absolute",
    top: 4,
    left: 4,
    zIndex: 1,
  },
});
